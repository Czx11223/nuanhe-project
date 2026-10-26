"""演示业务数据脚本（M5 联调交付用，独立于基础种子 seed.py）
功能：
1. 生成一组极简蓝调 SVG 占位图到 api/static/seed/（轮播/产品/新闻/案例封面），
   供前台无真实图片时也能呈现完整视觉效果；
2. 幂等地插入演示业务数据：轮播、产品、新闻、案例、招聘、关于板块、示例留言。
约定：
- 仅当对应业务表为空时插入（不覆盖已存在的数据，可重复执行）；
- 字段严格对齐 models.py（数据库设计文档 v1.1）；
- 执行方式：python -m app.seed_demo（在 api/ 目录下）。
"""
import json
import os
from datetime import datetime, timedelta

from app.db import SessionLocal
from app.models import (
    AboutContent,
    Banner,
    Case,
    Message,
    News,
    Product,
    ProductCategory,
    Recruitment,
)

# 占位图输出目录：api/static/seed/（由 StaticFiles /static 直接对外服务）
SEED_IMG_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "static", "seed"
)
# 蓝调配色板（与 UIUX 主色系一致，避免全站同一色块）
PALETTE = [
    ("#007AFF", "#0062CC"),  # 主蓝 -> 深蓝
    ("#0A84FF", "#5E5CE6"),  # 亮蓝 -> 紫
    ("#30B0C7", "#007AFF"),  # 青 -> 蓝
    ("#5856D6", "#0062CC"),  # 紫 -> 深蓝
    ("#0062CC", "#0A84FF"),  # 深蓝 -> 亮蓝
]


def gen_svg(filename: str, w: int, h: int, bg: str, bg2: str, title: str, sub: str = "") -> str:
    """生成一张极简蓝调 SVG 占位图，返回其 URL 路径。

    设计：对角双色背景 + 白色标题/副标题文字 + 底部品牌小字，
    不依赖外部图片服务（离线可用）。文字过多时由浏览器自动居中。
    """
    os.makedirs(SEED_IMG_DIR, exist_ok=True)
    path = os.path.join(SEED_IMG_DIR, filename)
    # 转义 XML 特殊字符，避免标题含 & < > 时 SVG 损坏
    esc = lambda s: s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="{bg}"/>
      <stop offset="100%" stop-color="{bg2}"/>
    </linearGradient>
  </defs>
  <rect width="{w}" height="{h}" fill="url(#g)"/>
  <circle cx="{w - w//5}" cy="{h//5}" r="{h//3}" fill="#ffffff" opacity="0.08"/>
  <circle cx="{w//6}" cy="{h - h//4}" r="{h//4}" fill="#ffffff" opacity="0.10"/>
  <text x="50%" y="{h * 0.46}" text-anchor="middle" fill="#ffffff" font-size="{max(int(w/16), 28)}" font-family="PingFang SC, Microsoft YaHei, sans-serif" font-weight="600">{esc(title)}</text>
  {f'<text x="50%" y="{h * 0.62}" text-anchor="middle" fill="#ffffff" opacity="0.85" font-size="{max(int(w/28), 16)}" font-family="PingFang SC, Microsoft YaHei, sans-serif">{esc(sub)}</text>' if sub else ''}
  <text x="50%" y="{h - 20}" text-anchor="middle" fill="#ffffff" opacity="0.55" font-size="14" font-family="PingFang SC, Microsoft YaHei, sans-serif">暖禾家具 · 匠心家居</text>
</svg>
'''
    with open(path, "w", encoding="utf-8") as f:
        f.write(svg)
    return f"/static/seed/{filename}"


def build_specs(lines) -> str:
    """把规格行列表拼成换行文本（产品 specs 展示用）。"""
    return "\n".join(lines)


def main():
    db = SessionLocal()
    now = datetime.utcnow()

    # ---------- 1. 轮播图（3 条，启用） ----------
    if db.query(Banner).count() == 0:
        banner_urls = [
            gen_svg("banner-1.svg", 1600, 600, *PALETTE[0], "匠心家居 · 悦享生活", "人体工学 × 原创设计 × 智能产线"),
            gen_svg("banner-2.svg", 1600, 600, *PALETTE[1], "全屋定制一站式交付", "设计 · 制造 · 安装 · 售后"),
            gen_svg("banner-3.svg", 1600, 600, *PALETTE[2], "2026 新品系列上市", "东方美学，现代演绎"),
        ]
        banners = [
            Banner(title="匠心家居 · 悦享生活", image_url=banner_urls[0], link_url="/products", sort=1, status=1),
            Banner(title="全屋定制一站式交付", image_url=banner_urls[1], link_url="/cases", sort=2, status=1),
            Banner(title="2026 新品系列上市", image_url=banner_urls[2], link_url="/news", sort=3, status=1),
        ]
        db.add_all(banners)
        print(f"[demo] banners +{len(banners)}")

    # ---------- 2. 产品（挂到 7 个一级分类下） ----------
    if db.query(Product).count() == 0:
        cats = {c.name: c.id for c in db.query(ProductCategory).all()}
        # 分类名 -> (产品名, 系列, 货号, 参考价, 封面, 多图, 描述, 规格, 推荐, 排序)
        product_specs = [
            ("胡桃禮", "云栖系列", "HT-101", 4999.0, "胡桃木实木餐桌", 1),
            ("如意春", "拾光系列", "RY-202", 3299.0, "布艺转角沙发", 0),
            ("禧YUE", "晨曦系列", "XY-303", 2599.0, "简约实木床", 1),
            ("柏悦", "雅居系列", "BY-404", 6999.0, "全实木书柜", 0),
            ("蓝宝嘉", "云朵系列", "LB-505", 1899.0, "儿童学习桌椅", 1),
            ("办公家具", "启航系列", "BG-606", 1299.0, "人体工学办公椅", 0),
            ("软体", "云感系列", "RT-707", 3999.0, "乳胶软体床垫", 1),
        ]
        products = []
        for name, series, code, price, desc, rec in product_specs:
            cat_id = cats.get(name)
            cid = cat_id if cat_id is not None else cats.get("胡桃禮")
            cover = gen_svg(f"product-{code}.svg", 800, 600, *PALETTE[len(products) % len(PALETTE)], name, series)
            gallery = json.dumps([
                gen_svg(f"product-{code}-a.svg", 800, 600, *PALETTE[(len(products) + 1) % len(PALETTE)], f"{name} · 细节", "实拍细节"),
                gen_svg(f"product-{code}-b.svg", 800, 600, *PALETTE[(len(products) + 2) % len(PALETTE)], f"{name} · 场景", "空间效果"),
            ])
            products.append(Product(
                category_id=cid, name=name, series=series, code=code,
                reference_price=price, cover_image=cover, gallery=gallery,
                description=f"<p><strong>{name}</strong> 是暖禾家具{series}的明星单品，融合人体工程学与东方美学。</p><p>{desc}。精选环保材质，工业 4.0 智能产线制造，品质稳定可控。</p>",
                specs=build_specs([
                    "主材：进口实木 / 环保板材（E0 级）",
                    "尺寸：详见产品图纸（可定制）",
                    "质保：5 年结构质保，终身维护",
                    "交付：全国物流 + 上门安装",
                ]),
                is_recommended=rec, sort=len(products) + 1, status=1,
            ))
        db.add_all(products)
        print(f"[demo] products +{len(products)}")

    # ---------- 3. 新闻（企业 3 + 行业 3，已发布） ----------
    if db.query(News).count() == 0:
        news_data = [
            ("暖禾家具 2026 新品发布会在佛山举行", "企业新闻", "暖禾全新六大系列首发，全屋定制业务升级"),
            ("暖禾 智能产线获评省级智能制造示范工厂", "企业新闻", "工业 4.0 落地提速，交付周期缩短 30%"),
            ("暖禾 第 300 家体验店于杭州开业", "企业新闻", "全国服务网络再进一步，覆盖 28 省"),
            ("2026 家居行业趋势：环保与智能成关键词", "行业资讯", "消费升级驱动定制家居与智能家居融合"),
            ("实木家具保养指南：五个日常小技巧", "行业资讯", "延长家具寿命，从正确保养开始"),
            ("家居软装搭配新趋势：极简蓝调风", "行业资讯", "色彩、材质与空间情绪的科学搭配"),
        ]
        news = []
        for i, (title, cat, summary) in enumerate(news_data):
            cover = gen_svg(f"news-{i + 1}.svg", 800, 450, *PALETTE[i % len(PALETTE)], cat, title[:12])
            news.append(News(
                title=title, category=cat, cover_image=cover, summary=summary,
                content=(
                    f"<p><strong>{title}</strong></p>"
                    f"<p>{summary}。暖禾家具持续深耕「研发-制造-销售」一体化能力，"
                    f"以人体工学与原创设计服务万千家庭。</p>"
                    f"<ul><li>本资讯由暖禾品牌中心发布</li><li>数据截至 {now.year} 年 {now.month} 月</li></ul>"
                ),
                author="暖禾品牌中心", publish_status=1,
                published_at=now - timedelta(days=i * 3 + 1),
                views=120 + i * 37, sort=i + 1,
            ))
        db.add_all(news)
        print(f"[demo] news +{len(news)}")

    # ---------- 4. 案例（4 条，启用） ----------
    if db.query(Case).count() == 0:
        case_data = [
            ("万科精装房全屋家具配套项目", "项目案例", "1200 套精装房整体家具配套，45 天交付"),
            ("星巴克城市旗舰店软装定制", "项目案例", "商业空间定制家具，极简风格与品牌调性统一"),
            ("三口之家 89㎡ 全屋定制改造", "客户案例", "小户型收纳与颜值兼顾的一体化方案"),
            ("企业高管办公室高端实木办公系列", "客户案例", "黑胡桃木办公套间，商务与舒适平衡"),
        ]
        cases = []
        for i, (title, cat, summary) in enumerate(case_data):
            cover = gen_svg(f"case-{i + 1}.svg", 800, 600, *PALETTE[i % len(PALETTE)], cat, title[:14])
            cases.append(Case(
                title=title, category=cat, cover_image=cover, summary=summary,
                content=(
                    f"<p>{summary}。</p>"
                    f"<p>从量尺、设计到生产安装，暖禾提供一站式服务，"
                    f"项目周期与品质均获客户高度认可。</p>"
                ),
                sort=i + 1, status=1,
            ))
        db.add_all(cases)
        print(f"[demo] cases +{len(cases)}")

    # ---------- 5. 招聘（社会 4 + 校园 2，招聘中） ----------
    if db.query(Recruitment).count() == 0:
        recruit_data = [
            (1, "高级家具结构设计师", "研发中心", "广东佛山", "负责新产品结构设计与工艺落地。"),
            (1, "全屋定制方案顾问", "营销中心", "广东佛山", "为客户提供全屋定制整体方案。"),
            (1, "供应链质量工程师", "供应链部", "广东佛山", "负责供应商质量与来料检验体系。"),
            (1, "电商运营经理", "电商部", "广东佛山", "负责天猫/京东店铺整体运营。"),
            (2, "工业设计实习生（2027 届）", "研发中心", "广东佛山", "参与新产品外观与结构设计。"),
            (2, "管培生（生产/供应链方向）", "制造中心", "广东佛山", "轮岗培养，2 年成长为骨干。"),
        ]
        recruits = []
        for i, (t, title, dept, loc, desc) in enumerate(recruit_data):
            recruits.append(Recruitment(
                type=t, title=title, department=dept, location=loc,
                description=f"<p>{desc}</p><p>协同设计/生产/交付团队，推动项目高质量落地。</p>",
                requirements="<p>本科及以上学历，相关专业背景优先；</p><p>具备良好的沟通与团队协作能力；</p><p>认同暖禾品牌理念，热爱家居行业。</p>",
                status=1, sort=i + 1,
            ))
        db.add_all(recruits)
        print(f"[demo] recruitments +{len(recruits)}")

    # ---------- 6. 关于我们板块（about_暖禾 + brand；history 由前端常量展示） ----------
    if db.query(AboutContent).count() == 0:
        abouts = [
            AboutContent(
                section="about_暖禾", title="关于暖禾",
                content=(
                    "<p>暖禾家具创立于 1998 年，是一家集研发、制造、销售于一体的现代化家居企业。</p>"
                    "<p>我们坚持「匠心家居，悦享生活」的品牌理念，以人体工程学与原创设计为核心，"
                    "通过工业 4.0 智能产线，为万千家庭提供高品质的全屋家居解决方案。</p>"
                    "<p>目前暖禾已建成 12 条智能产线，拥有 100+ 项设计专利，"
                    "全国 300+ 家体验门店，服务网络覆盖 28 个省份。</p>"
                ),
                image_url=gen_svg("about-暖禾.svg", 800, 450, *PALETTE[0], "关于暖禾", "匠心家居 · 悦享生活"),
                sort=1, status=1,
            ),
            AboutContent(
                section="brand", title="品牌介绍",
                content=(
                    "<p><strong>暖禾</strong> —— 取意「大道至简」，以极简蓝调美学表达现代家居态度。</p>"
                    "<p>品牌四大核心优势：人体工程学、原创设计、智能产线、贴心售后。</p>"
                    "<p>我们相信，好的家具不仅是一件器物，更是生活方式的延伸。</p>"
                ),
                image_url=gen_svg("about-brand.svg", 800, 450, *PALETTE[1], "品牌介绍", "大道至简 · 悦享生活"),
                sort=2, status=1,
            ),
        ]
        db.add_all(abouts)
        print(f"[demo] about_contents +{len(abouts)}")

    # ---------- 7. 示例留言（1 条待处理留言 + 1 条待处理简历投递，供后台演示处理/回复） ----------
    if db.query(Message).count() == 0:
        msgs = [
            Message(
                name="张先生", phone="13900001111", email="zhang@example.com", type="咨询",
                content="想了解全屋定制的整体报价与设计流程，方便约一次到店体验吗？",
                status=0,
            ),
            Message(
                name="李同学", phone="13900002222", type="简历投递",
                content="我是工业设计专业大三学生，希望申请 2027 届工业设计实习生岗位。",
                status=0,
            ),
        ]
        db.add_all(msgs)
        print(f"[demo] messages +{len(msgs)}")

    db.commit()
    db.close()
    print("[demo] done")


if __name__ == "__main__":
    main()
