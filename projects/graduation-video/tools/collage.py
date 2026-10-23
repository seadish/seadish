"""실사 사진 → 수채화·콜라주 스티커 (기존 학생 사진과 같은 질감)

사용법: python3 collage.py 입력.jpg 출력.png [--crop 4:5] [--focus x,y] [--edge cloud|rect] [--plain]
"""
import argparse
import cv2
import numpy as np
from PIL import Image, ImageOps, ImageFilter


def load(path, long_side=1200):
    im = ImageOps.exif_transpose(Image.open(path)).convert('RGB')
    im.thumbnail((long_side * 2, long_side * 2), Image.LANCZOS)
    return im


def crop_ratio(im, ratio, focus):
    w, h = im.size
    rw, rh = ratio
    if w / h > rw / rh:
        nw, nh = int(h * rw / rh), h
    else:
        nw, nh = w, int(w * rh / rw)
    fx, fy = focus
    x0 = int(min(max(fx * w - nw / 2, 0), w - nw))
    y0 = int(min(max(fy * h - nh / 2, 0), h - nh))
    return im.crop((x0, y0, x0 + nw, y0 + nh))


def watercolor(im):
    bgr = cv2.cvtColor(np.asarray(im), cv2.COLOR_RGB2BGR)
    h, w = bgr.shape[:2]
    # 1) 붓질: 경계 보존 평탄화 + 원본을 섞어 얼굴 닮음 유지
    paint = cv2.stylization(bgr, sigma_s=30, sigma_r=0.25)
    smooth = cv2.bilateralFilter(bgr, 7, 40, 40)
    mix = cv2.addWeighted(paint, 0.45, smooth, 0.55, 0).astype(np.float32) / 255
    # 2) 수채화 톤: 검정을 들어 올리고 밝게, 채도 살짝 업
    mix = 0.10 + 0.86 * np.power(mix, 0.82)
    hsv = cv2.cvtColor((mix * 255).astype(np.uint8), cv2.COLOR_BGR2HSV).astype(np.float32)
    hsv[..., 1] = np.clip(hsv[..., 1] * 1.28 + 6, 0, 255)
    mix = cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2BGR).astype(np.float32) / 255
    # 3) 물감 번짐: 색면 경계가 살짝 진해지는 효과
    blur = cv2.GaussianBlur(mix, (0, 0), 3)
    edge_dark = np.clip((blur - mix) * 1.6, -0.2, 0.2)
    mix = mix - np.abs(edge_dark).mean(axis=2, keepdims=True) * 0.6
    # 4) 가는 연필 선
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    lines = cv2.Canny(cv2.GaussianBlur(gray, (5, 5), 0), 40, 110)
    lines = cv2.GaussianBlur(lines, (3, 3), 0).astype(np.float32) / 255
    mix = mix * (1 - lines[..., None] * 0.35)
    # 5) 종이 결과 얼룩
    rng = np.random.default_rng(3)
    grain = cv2.GaussianBlur(rng.normal(0, 1, (h, w)).astype(np.float32), (0, 0), 1.0)
    blot = cv2.resize(cv2.GaussianBlur(rng.normal(0, 1, (h // 20 + 1, w // 20 + 1)).astype(np.float32), (0, 0), 1.5), (w, h))
    mix = mix * (1 + grain[..., None] * 0.025 + blot[..., None] * 0.04)
    paper = np.array([0.93, 0.975, 1.0], np.float32)  # BGR, 따뜻한 크림색 종이
    mix = mix * paper + (1 - paper) * 0.0
    out = np.clip(mix * 255, 0, 255).astype(np.uint8)
    return Image.fromarray(cv2.cvtColor(out, cv2.COLOR_BGR2RGB))


def sticker_mask(w, h, border, kind, seed=1):
    """사진 영역(photo)과 흰 테두리를 포함한 스티커 외곽(outer) 마스크"""
    from PIL import ImageDraw
    rng = np.random.default_rng(seed)
    pad = border * 3
    W, H = w + pad * 2, h + pad * 2
    photo = Image.new('L', (W, H), 0)
    outer = Image.new('L', (W, H), 0)
    dp, do = ImageDraw.Draw(photo), ImageDraw.Draw(outer)
    if kind == 'cloud':
        r = border * 1.6
        dp.rounded_rectangle((pad, pad, pad + w, pad + h), int(border * 1.2), fill=255)
        do.rectangle((pad - border, pad - border, pad + w + border, pad + h + border), fill=255)
        step = r * 1.35
        def bumps(x0, y0, x1, y1):
            n = max(2, int(np.hypot(x1 - x0, y1 - y0) / step))
            for t in np.linspace(0, 1, n):
                x, y = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
                rr = r * (0.85 + rng.random() * 0.35)
                do.ellipse((x - rr, y - rr, x + rr, y + rr), fill=255)
        e = border * 0.6
        bumps(pad - e, pad - e, pad + w + e, pad - e); bumps(pad + w + e, pad - e, pad + w + e, pad + h + e)
        bumps(pad + w + e, pad + h + e, pad - e, pad + h + e); bumps(pad - e, pad + h + e, pad - e, pad - e)
    else:
        j = border * 0.6
        q = lambda x, y: (x + rng.uniform(-j, j), y + rng.uniform(-j, j))
        dp.polygon([q(pad, pad), q(pad + w, pad), q(pad + w, pad + h), q(pad, pad + h)], fill=255)
        b = border * 1.1
        do.polygon([q(pad - b, pad - b), q(pad + w + b, pad - b), q(pad + w + b, pad + h + b), q(pad - b, pad + h + b)], fill=255)
    return photo.filter(ImageFilter.GaussianBlur(0.8)), outer.filter(ImageFilter.GaussianBlur(1.0)), pad


def make_sticker(src, dst, crop=None, focus=(0.5, 0.42), edge='cloud', size=1000, seed=1, plain=False):
    im = load(src)
    if crop:
        a, b = map(int, crop.split(':'))
        im = crop_ratio(im, (a, b), focus)
    im.thumbnail((size, size), Image.LANCZOS)
    art = im if plain else watercolor(im)
    w, h = art.size
    border = max(10, int(max(w, h) * 0.022))
    photo, outer, pad = sticker_mask(w, h, border, edge, seed)
    W, H = outer.size
    canvas = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    white = Image.new('RGBA', (W, H), (252, 250, 244, 255))
    canvas.paste(white, (0, 0), outer)
    layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    layer.paste(art, (pad, pad))
    canvas.paste(layer, (0, 0), photo)
    canvas = canvas.crop(canvas.getbbox())
    canvas.save(dst, optimize=True)
    return canvas.size


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('src'); ap.add_argument('dst')
    ap.add_argument('--crop'); ap.add_argument('--focus', default='0.5,0.42')
    ap.add_argument('--edge', default='cloud'); ap.add_argument('--size', type=int, default=1000)
    ap.add_argument('--seed', type=int, default=1)
    ap.add_argument('--plain', action='store_true', help='수채화 질감 없이 사진 그대로 (테두리만)')
    a = ap.parse_args()
    print(make_sticker(a.src, a.dst, a.crop, tuple(map(float, a.focus.split(','))), a.edge, a.size, a.seed, a.plain))
