<#
.SYNOPSIS
  暖禾家具官网 —— 阿里云资源一键创建脚本（VPC / 交换机 / 安全组 / NAS / FC 函数 / HTTP 触发器）

.DESCRIPTION
  按 deploy/README-部署指南.md 的第 3.2、3.3 节自动创建资源，幂等：已存在的资源会复用，不会重复创建。
  镜像（ACR）需要你自己先构建，本脚本只负责「跑起来的那一层」。

  前置：aliyun CLI 已安装，且执行过 aliyun configure（或设置环境变量 ALIBABA_CLOUD_ACCESS_KEY_ID 等）。

.EXAMPLE
  # 先做计划，只打印将执行的命令，不真正创建
  .\provision.ps1 -Image registry.cn-hangzhou.aliyuncs.com/nuanhe/nuanhe-api:v1 -Plan

.EXAMPLE
  # 正式创建
  .\provision.ps1 -Image registry.cn-hangzhou.aliyuncs.com/nuanhe/nuanhe-api:v1

.EXAMPLE
  # 代码更新后，用同一脚本更新函数镜像
  .\provision.ps1 -Image registry.cn-hangzhou.aliyuncs.com/nuanhe/nuanhe-api:v2 -Update
#>
[CmdletBinding()]
param(
    # 地域：必须与 ACR、NAS 同地域
    [string]$Region = 'cn-hangzhou',

    # 资源名前缀，最终会生成 nuanhe-vpc / nuanhe-vsw / nuanhe-nas / nuanhe-api 等
    [string]$Prefix = 'nuanhe',

    [string]$FunctionName = 'nuanhe-api',

    # 必填：ACR 镜像完整地址，必须带 tag
    [string]$Image = '',

    # 镜像仓库为私有时的 ACR 固定密码（公开仓库留空即可）
    [string]$AcrUserName = '',
    [string]$AcrPassword = '',

    # JWT 密钥；留空则自动生成 32 字节随机串
    [string]$JwtSecret = '',

    # 允许的前端来源，默认放开（拿到 Pages 域名后再收紧）
    [string]$CorsOrigins = '*',

    [double]$Cpu = 1.0,
    [int]$MemorySize = 1024,
    [int]$Timeout = 60,

    # 更新已存在的函数（改镜像版本时用），不加则函数已存在时报错退出
    [switch]$Update,

    # 只打印将执行的命令，不做任何变更
    [switch]$Plan,

    # 复用已有资源（不填则按名字自动查找 / 创建）
    [string]$VpcId = '',
    [string]$VSwitchId = '',
    [string]$SecurityGroupId = '',
    [string]$FileSystemId = '',

    [string]$MountDir = '/mnt/nas'
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

# ---------------------------------------------------------------- 输出工具
function Write-Section($t) { Write-Host "`n== $t" -ForegroundColor Cyan }
function Write-Ok($t) { Write-Host "   [OK] $t" -ForegroundColor Green }
function Write-Info($t) { Write-Host "   - $t" -ForegroundColor Gray }
function Write-Warn2($t) { Write-Host "   [!] $t" -ForegroundColor Yellow }
function Write-Fail($t) { Write-Host "   [X] $t" -ForegroundColor Red }

# ---------------------------------------------------------------- CLI 定位
$Aliyun = $env:ALIYUN_CLI
if (-not $Aliyun) {
    $candidates = @(
        'C:\Users\20454\.workbuddy\binaries\aliyun-cli\aliyun.exe',
        "$env:ProgramFiles\aliyun-cli\aliyun.exe"
    )
    $Aliyun = ($candidates | Where-Object { Test-Path $_ } | Select-Object -First 1)
    if (-not $Aliyun) {
        $cmd = Get-Command aliyun -ErrorAction SilentlyContinue
        if ($cmd) { $Aliyun = $cmd.Source }
    }
}
if (-not $Aliyun -or -not (Test-Path $Aliyun)) {
    throw "找不到 aliyun CLI。请安装后重试，或用环境变量 ALIYUN_CLI 指定完整路径。"
}

$StateFile = Join-Path $PSScriptRoot '.provision-state.json'
$state = @{}
if (Test-Path $StateFile) {
    # 兼容 PowerShell 5.1（不支持 ConvertFrom-Json -AsHashtable）
    $obj = Get-Content $StateFile -Raw -Encoding UTF8 | ConvertFrom-Json
    $obj.PSObject.Properties | ForEach-Object { $state[$_.Name] = $_.Value }
    Write-Info "读取已有进度：$StateFile"
}

# ---------------------------------------------------------------- 调用封装
function Invoke-Aliyun {
    param(
        [Parameter(Mandatory)][string[]]$Argv,
        [switch]$AllowFail,
        [int]$Retry = 3
    )
    if ($Plan) { return $null }

    $lastErr = ''
    for ($i = 1; $i -le $Retry; $i++) {
        $raw = (& $Aliyun @Argv 2>&1 | Out-String).Trim()
        $code = $LASTEXITCODE

        if ($raw) {
            $obj = $null
            try { $obj = $raw | ConvertFrom-Json } catch { }

            if ($obj -and ($obj.PSObject.Properties.Name -contains 'error')) {
                $ec = $obj.error.code
                $em = $obj.error.message
                $lastErr = "$ec : $em"
                if ($ec -in @('ServiceUnavailable', 'InternalError', 'Throttling', 'Throttling.User') -and $i -lt $Retry) {
                    Write-Info "临时错误（$ec），$($i*2) 秒后重试…"
                    Start-Sleep -Seconds ($i * 2)
                    continue
                }
                # AllowFail 仅用于「探测资源是否存在」，不存在属正常情况，不打印
                if ($AllowFail) { return $null }
                throw "aliyun $($Argv[0]) $($Argv[1]) 失败 → $lastErr"
            }

            if ($code -eq 0 -and $obj) { return $obj }
            if ($code -eq 0) { return $raw }
        }

        if ($i -lt $Retry) { Start-Sleep -Seconds ($i * 2) }
    }

    if ($AllowFail) { Write-Info "命令无输出或失败，已忽略：$lastErr"; return $null }
    throw "aliyun $($Argv[0]) $($Argv[1]) 失败：$lastErr"
}

function Wait-Until {
    param(
        [Parameter(Mandatory)][scriptblock]$Check,
        [Parameter(Mandatory)][string]$What,
        [int]$TimeoutSeconds = 600,
        [int]$IntervalSeconds = 6
    )
    if ($Plan) { return }
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        if (& $Check) { Write-Ok "$What 就绪"; return }
        Start-Sleep -Seconds $IntervalSeconds
        Write-Host '.' -NoNewline -ForegroundColor DarkGray
    }
    Write-Host ''
    throw "等待 $What 超时（$TimeoutSeconds 秒）"
}

function Save-State {
    if ($Plan) { return }
    $state | ConvertTo-Json -Depth 6 | Set-Content -Path $StateFile -Encoding UTF8
}

# ---------------------------------------------------------------- 前置检查
Write-Section "0. 前置检查"

if (-not $Image) {
    throw "必须用 -Image 指定镜像，例如 registry.cn-hangzhou.aliyuncs.com/<命名空间>/nuanhe-api:v1"
}
if ($Image -notmatch ':[^/:]+$') {
    throw "镜像地址缺少 tag（形如 .../nuanhe-api:v1）。FC 会报 image uri should have tag，请先在 ACR 构建出 v1。"
}
Write-Ok "镜像：$Image"

if (-not $JwtSecret) {
    $bytes = New-Object 'System.Byte[]' 32
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    $JwtSecret = ($bytes | ForEach-Object { $_.ToString('x2') }) -join ''
    Write-Warn2 "未指定 -JwtSecret，已生成随机密钥（会写入状态文件，请自行留存）"
}

# 规格校验：FC 要求内存为 64 的倍数，且 cpu 与内存(GiB) 比例在 1:1 ~ 1:4 之间
if ($MemorySize % 64 -ne 0 -or $MemorySize -lt 128) {
    throw "MemorySize 必须是 64 的倍数且不小于 128（当前 $MemorySize）"
}
$ratio = [math]::Round(($MemorySize / 1024) / $Cpu, 2)
if ($ratio -lt 1 -or $ratio -gt 4) {
    throw "cpu 与内存比例不合法：$Cpu 核 / $MemorySize MB = 1:$ratio，FC 要求 1:1 ~ 1:4"
}

if (-not $Plan) {
    $ident = Invoke-Aliyun @('sts', 'GetCallerIdentity')
    Write-Ok "当前账号：$($ident.AccountId)  身份：$($ident.Arn)"
}
else {
    Write-Section "计划模式（-Plan）：不做任何变更，仅列出将执行的动作"
    $steps = @(
        @("1. VPC",        "$Prefix-vpc",       "172.16.0.0/12"),
        @("2. 交换机",     "$Prefix-vsw",       "172.16.1.0/24，可用区自动挑选"),
        @("3. 安全组",     "$Prefix-sg",        "FC 的 VPC 配置需要"),
        @("4. NAS",        "$Prefix-nas",       "通用型 / 容量型 / 按量付费"),
        @("5. NAS 挂载点", "VPC 挂载",          "与 FC 同 VPC、同地域"),
        @("6. FC 函数",    "$FunctionName",     "镜像 $Image，9000 端口，$Cpu 核 / $MemorySize MB"),
        @("7. 触发器",     "http",              "HTTP 触发器，匿名访问")
    )
    foreach ($s in $steps) {
        Write-Host ("   {0,-14} {1,-30} {2}" -f $s[0], $s[1], $s[2])
    }

    Write-Host "`n  函数环境变量：" -ForegroundColor Cyan
    Write-Host "    DATA_DIR     = $MountDir/$Prefix"
    Write-Host "    DB_PATH      = $MountDir/$Prefix/app.db"
    Write-Host "    UPLOAD_DIR   = $MountDir/$Prefix/uploads"
    Write-Host "    CORS_ORIGINS = $CorsOrigins"
    Write-Host "    JWT_SECRET   = 已生成随机值（正式执行时写入）"
    Write-Host "`n  确认无误后去掉 -Plan 重新执行。" -ForegroundColor Cyan
    return
}

# ---------------------------------------------------------------- VPC
Write-Section "1. VPC"

if (-not $VpcId -and $state.vpcId) { $VpcId = $state.vpcId }

if (-not $VpcId) {
    $list = Invoke-Aliyun @('vpc', 'DescribeVpcs', '--RegionId', $Region, '--PageSize', '50') -AllowFail
    $hit = $list.Vpcs.Vpc | Where-Object { $_.VpcName -eq "$Prefix-vpc" } | Select-Object -First 1
    if ($hit) {
        $VpcId = $hit.VpcId
        Write-Ok "复用已有 VPC：$VpcId"
    }
    else {
        Write-Info "创建 VPC $Prefix-vpc (172.16.0.0/12)"
        $r = Invoke-Aliyun @('vpc', 'CreateVpc', '--RegionId', $Region, '--CidrBlock', '172.16.0.0/12', '--VpcName', "$Prefix-vpc", '--Description', 'nuanhe demo vpc')
        $VpcId = $r.VpcId
        Write-Ok "VPC 已创建：$VpcId"
        Wait-Until -What "VPC 可用" -Check {
            $d = Invoke-Aliyun @('vpc', 'DescribeVpcs', '--RegionId', $Region, '--VpcId', $VpcId)
            $d.Vpcs.Vpc[0].Status -eq 'Available'
        }
    }
}
$state.vpcId = $VpcId
Save-State

# ---------------------------------------------------------------- 交换机 + 安全组
Write-Section "2. 交换机 / 安全组"

if (-not $VSwitchId -and $state.vSwitchId) { $VSwitchId = $state.vSwitchId }

if (-not $VSwitchId) {
    Write-Info "挑选可用区（需同时支持 VPC 交换机与 NAS）"
    $vpcZones = (Invoke-Aliyun @('vpc', 'DescribeZones', '--RegionId', $Region)).Zones.Zone
    $nasZones = (Invoke-Aliyun @('nas', 'DescribeZones', '--RegionId', $Region, '--FileSystemType', 'standard') -AllowFail)
    $zoneId = $null
    if ($nasZones) {
        $nasZoneIds = $nasZones.Zones.Zone | ForEach-Object { $_.ZoneId }
        $zoneId = ($vpcZones | Where-Object { $nasZoneIds -contains $_.ZoneId } | Select-Object -First 1).ZoneId
    }
    if (-not $zoneId) {
        $zoneId = ($vpcZones | Where-Object {
                $_.AvailableResourceCreation.VSwitch -contains 'Available'
            } | Select-Object -First 1).ZoneId
    }
    if (-not $zoneId) { throw "在 $Region 没找到可用可用区" }
    Write-Ok "可用区：$zoneId"

    $sw = Invoke-Aliyun @('vpc', 'DescribeVSwitches', '--RegionId', $Region, '--VpcId', $VpcId, '--PageSize', '50') -AllowFail
    $hitSw = $sw.VSwitches.VSwitch | Where-Object { $_.VSwitchName -eq "$Prefix-vsw" } | Select-Object -First 1
    if ($hitSw) {
        $VSwitchId = $hitSw.VSwitchId
        Write-Ok "复用已有交换机：$VSwitchId"
    }
    else {
        Write-Info "创建交换机 $Prefix-vsw (172.16.1.0/24)"
        $r = Invoke-Aliyun @('vpc', 'CreateVSwitch', '--RegionId', $Region, '--VpcId', $VpcId, '--CidrBlock', '172.16.1.0/24', '--ZoneId', $zoneId, '--VSwitchName', "$Prefix-vsw")
        $VSwitchId = $r.VSwitchId
        Write-Ok "交换机已创建：$VSwitchId"
    }
}
$state.vSwitchId = $VSwitchId
if ($zoneId) { $state.zoneId = $zoneId }
Save-State

if (-not $SecurityGroupId -and $state.securityGroupId) { $SecurityGroupId = $state.securityGroupId }

if (-not $SecurityGroupId) {
    $sgs = Invoke-Aliyun @('ecs', 'DescribeSecurityGroups', '--RegionId', $Region, '--VpcId', $VpcId, '--PageSize', '50') -AllowFail
    $hitSg = $sgs.SecurityGroups.SecurityGroup | Where-Object { $_.SecurityGroupName -eq "$Prefix-sg" } | Select-Object -First 1
    if ($hitSg) {
        $SecurityGroupId = $hitSg.SecurityGroupId
        Write-Ok "复用已有安全组：$SecurityGroupId"
    }
    else {
        Write-Info "创建安全组 $Prefix-sg"
        $r = Invoke-Aliyun @('ecs', 'CreateSecurityGroup', '--RegionId', $Region, '--VpcId', $VpcId, '--SecurityGroupName', "$Prefix-sg", '--Description', 'nuanhe fc sg')
        $SecurityGroupId = $r.SecurityGroupId
        Write-Ok "安全组已创建：$SecurityGroupId"
    }
}
$state.securityGroupId = $SecurityGroupId
Save-State

# ---------------------------------------------------------------- NAS
Write-Section "3. NAS 文件系统"

if (-not $FileSystemId -and $state.fileSystemId) { $FileSystemId = $state.fileSystemId }

if (-not $FileSystemId) {
    $fs = Invoke-Aliyun @('nas', 'DescribeFileSystems', '--RegionId', $Region, '--FileSystemType', 'standard', '--PageSize', '50') -AllowFail
    $hitFs = $fs.FileSystems.FileSystem | Where-Object { $_.Description -eq "$Prefix-nas" } | Select-Object -First 1
    if ($hitFs) {
        $FileSystemId = $hitFs.FileSystemId
        Write-Ok "复用已有文件系统：$FileSystemId"
    }
    else {
        Write-Info "创建 NAS 通用型文件系统（按量付费，容量型）"
        $r = Invoke-Aliyun @('nas', 'CreateFileSystem', '--RegionId', $Region,
            '--FileSystemType', 'standard', '--ProtocolType', 'NFS',
            '--StorageType', 'Capacity', '--ChargeType', 'PayAsYouGo',
            '--Description', "$Prefix-nas")
        $FileSystemId = $r.FileSystemId
        Write-Ok "文件系统已创建：$FileSystemId"
    }
}
$state.fileSystemId = $FileSystemId
Save-State

Write-Info "等待文件系统变为可用…"
Wait-Until -What "NAS 文件系统" -TimeoutSeconds 900 -Check {
    $d = Invoke-Aliyun @('nas', 'DescribeFileSystems', '--RegionId', $Region, '--FileSystemId', $FileSystemId)
    $d.FileSystems.FileSystem[0].Status -eq 'Available'
}

Write-Info "检查挂载点"
$mt = Invoke-Aliyun @('nas', 'DescribeMountTargets', '--RegionId', $Region, '--FileSystemId', $FileSystemId, '--NetworkType', 'VPC') -AllowFail
$mtHit = $mt.MountTargets.MountTarget | Where-Object { $_.VpcId -eq $VpcId } | Select-Object -First 1
if ($mtHit) {
    Write-Ok "复用已有挂载点：$($mtHit.MountTargetDomain)"
}
else {
    Write-Info "创建 VPC 挂载点（$VpcId / $VSwitchId）"
    $r = Invoke-Aliyun @('nas', 'CreateMountTarget', '--RegionId', $Region, '--FileSystemId', $FileSystemId,
        '--NetworkType', 'VPC', '--VpcId', $VpcId, '--VSwitchId', $VSwitchId,
        '--AccessGroupName', 'DEFAULT_VPC_GROUP_NAME') -AllowFail
    if (-not $r) {
        Write-Warn2 "DEFAULT_VPC_GROUP_NAME 不可用，改用默认权限组重试"
        $r = Invoke-Aliyun @('nas', 'CreateMountTarget', '--RegionId', $Region, '--FileSystemId', $FileSystemId,
            '--NetworkType', 'VPC', '--VpcId', $VpcId, '--VSwitchId', $VSwitchId)
    }
    Write-Ok "挂载点已创建"
}

Wait-Until -What "NAS 挂载点" -TimeoutSeconds 600 -Check {
    $d = Invoke-Aliyun @('nas', 'DescribeMountTargets', '--RegionId', $Region, '--FileSystemId', $FileSystemId, '--NetworkType', 'VPC')
    ($d.MountTargets.MountTarget | Where-Object { $_.VpcId -eq $VpcId } | Select-Object -First 1).Status -eq 'Active'
}

$NasDomain = "$FileSystemId.$Region.nas.aliyuncs.com"
$NasServerAddr = "${NasDomain}:/"
Write-Ok "NAS 挂载地址：$NasServerAddr"

# ---------------------------------------------------------------- FC 函数
Write-Section "4. FC 函数（自定义容器）"

$envVars = [ordered]@{
    DATA_DIR           = "$MountDir/$Prefix"
    DB_PATH            = "$MountDir/$Prefix/app.db"
    UPLOAD_DIR         = "$MountDir/$Prefix/uploads"
    JWT_SECRET         = $JwtSecret
    JWT_EXPIRE_MINUTES = '720'
    CORS_ORIGINS       = $CorsOrigins
    TZ                 = 'Asia/Shanghai'
}

$container = [ordered]@{
    image      = $Image
    port       = 9000
    entrypoint = @('/usr/local/bin/entrypoint.sh')
    healthCheckConfig = [ordered]@{
        httpGetUrl          = '/api/health'
        initialDelaySeconds = 10
        periodSeconds       = 15
        timeoutSeconds      = 5
        failureThreshold    = 3
        successThreshold    = 1
    }
}
if ($AcrUserName -and $AcrPassword) {
    $container.registryConfig = [ordered]@{ authConfig = [ordered]@{ userName = $AcrUserName; password = $AcrPassword } }
    Write-Info "已配置 ACR 私有仓库凭证"
}

$body = [ordered]@{
    functionName        = $FunctionName
    description         = '暖禾家具官网 API（FastAPI + SQLite on NAS）'
    runtime             = 'custom-container'
    handler             = 'index.handler'
    cpu                 = $Cpu
    memorySize          = $MemorySize
    timeout             = $Timeout
    instanceConcurrency = 1
    diskSize            = 512
    environmentVariables = $envVars
    customContainerConfig = $container
    vpcConfig           = [ordered]@{
        vpcId           = $VpcId
        vSwitchIds      = @($VSwitchId)
        securityGroupId = $SecurityGroupId
    }
    nasConfig           = [ordered]@{
        userId      = 0
        groupId     = 0
        mountPoints = @([ordered]@{ mountDir = $MountDir; serverAddr = $NasServerAddr; enableTLS = $false })
    }
}
$json = $body | ConvertTo-Json -Depth 10 -Compress

$existing = Invoke-Aliyun @('fc', 'GetFunction', '--region', $Region, '--functionName', $FunctionName) -AllowFail

if ($existing -and $existing.functionName) {
    if (-not $Update) {
        throw "函数 $FunctionName 已存在。改镜像请加 -Update；只想看现在的地址可直接跑：aliyun fc GetTrigger --region $Region --functionName $FunctionName --triggerName http"
    }
    Write-Info "更新已有函数：$FunctionName"
    Invoke-Aliyun @('fc', 'UpdateFunction', '--region', $Region, '--functionName', $FunctionName, '--body', $json) | Out-Null
    Write-Ok "函数已更新为 $Image"
}
else {
    Write-Info "创建函数 $FunctionName（$Cpu 核 / $MemorySize MB / 端口 9000）"
    Invoke-Aliyun @('fc', 'CreateFunction', '--region', $Region, '--body', $json) | Out-Null
    Write-Ok "函数已创建"
}
$state.functionName = $FunctionName
Save-State

# ---------------------------------------------------------------- HTTP 触发器
Write-Section "5. HTTP 触发器"

$triggerName = 'http'
# 注意：FC 3.0 的 triggerConfig 字段类型是「字符串」，不是对象，必须先序列化再塞进去
$trigCfgJson = [ordered]@{
    authType = 'anonymous'
    methods  = @('GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS')
} | ConvertTo-Json -Depth 5 -Compress

$trigBody = [ordered]@{
    triggerName   = $triggerName
    description   = 'public http trigger'
    triggerType   = 'http'
    qualifier     = 'LATEST'
    triggerConfig = $trigCfgJson
} | ConvertTo-Json -Depth 6 -Compress

$trig = Invoke-Aliyun @('fc', 'GetTrigger', '--region', $Region, '--functionName', $FunctionName, '--triggerName', $triggerName) -AllowFail
if ($trig -and $trig.triggerName) {
    Write-Ok "复用已有触发器：$triggerName"
}
else {
    Write-Info "创建 HTTP 触发器（匿名访问，鉴权由应用 JWT 负责）"
    Invoke-Aliyun @('fc', 'CreateTrigger', '--region', $Region, '--functionName', $FunctionName, '--body', $trigBody) | Out-Null
    Write-Ok "触发器已创建"
}

$final = Invoke-Aliyun @('fc', 'GetTrigger', '--region', $Region, '--functionName', $FunctionName, '--triggerName', $triggerName) -AllowFail
$url = $final.httpTrigger.urlInternet
if ($url) { $state.url = $url; Save-State }

# ---------------------------------------------------------------- 汇总
Write-Section "完成"

Write-Host @"
  地域            : $Region
  VPC             : $VpcId
  交换机          : $VSwitchId
  安全组          : $SecurityGroupId
  NAS 文件系统    : $FileSystemId
  NAS 挂载地址    : $NasServerAddr
  FC 函数         : $FunctionName
  API 地址        : $url
"@ -ForegroundColor White

if ($url) {
    Write-Host "  下一步：" -ForegroundColor Cyan
    Write-Host "    1) 验证：curl $url/api/health" -ForegroundColor Gray
    Write-Host "    2) 构建前端时注入 VITE_API_BASE=$url" -ForegroundColor Gray
    Write-Host "    3) 拿到 Pages 域名后把函数环境变量 CORS_ORIGINS 改成精确域名（现在是 $CorsOrigins）" -ForegroundColor Gray
    Write-Host "    4) 控制台 → 函数 → 弹性配置 → 函数配额，把弹性实例上限设为 1（保护 SQLite 单写者）" -ForegroundColor Gray
    Write-Host "    5) 首次调用后到 NAS 确认 /$Prefix 目录已生成 app.db 与 seed、uploads" -ForegroundColor Gray
}
