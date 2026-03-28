import argparse
import json
import os
from pathlib import Path
from typing import Any

import dashscope
import requests
from dashscope import MultiModalConversation
from dotenv import load_dotenv

dashscope.base_http_api_url = 'https://dashscope.aliyuncs.com/api/v1'

DEFAULT_PROMPT = (
    '为校园门户登录页生成一张横向主视觉背景图。'
    '画面是简约清新的校园清晨场景：林荫道、教学楼、树影、草地与淡蓝色晨雾，'
    '整体采用冷淡蓝、雾白和少量青绿色，构图干净安静，适合做登录页背景。'
    '不要人物、不要车辆、不要文字、不要 logo、不要路牌特写、不要 UI 面板、'
    '不要水印、不要卡片。画面中心略虚化，保留中间区域给居中登录卡片使用。'
)
DEFAULT_REFERENCE_IMAGES: list[str] = []


def build_messages(prompt: str, reference_images: list[str]) -> list[dict[str, Any]]:
    """按百炼多模态格式构造输入消息。"""
    content: list[dict[str, str]] = [
        {'image': image_url} for image_url in reference_images
    ]
    content.append({'text': prompt})
    return [{'role': 'user', 'content': content}]


def normalize_response_payload(response: Any) -> dict[str, Any]:
    """把 SDK 返回对象标准化为字典，便于后续解析。"""
    if isinstance(response, dict):
        return response

    if hasattr(response, 'to_dict'):
        return response.to_dict()

    return json.loads(json.dumps(response, default=lambda value: value.__dict__))


def extract_image_urls(response_payload: dict[str, Any]) -> list[str]:
    """从百炼返回结果中提取图片地址列表。"""
    content_items = (
        response_payload.get('output', {})
        .get('choices', [{}])[0]
        .get('message', {})
        .get('content', [])
    )
    image_urls = [
        item['image']
        for item in content_items
        if isinstance(item, dict) and item.get('image')
    ]

    if not image_urls:
        raise ValueError('未从百炼响应中解析到图片地址')

    return image_urls


def build_output_paths(output_dir: Path, image_count: int) -> list[Path]:
    """按稳定命名生成输出图片路径。"""
    return [output_dir / f'login-hero-{index}.png' for index in range(1, image_count + 1)]


def download_image(image_url: str, output_path: Path) -> None:
    """下载单张图片并保存到目标路径。"""
    response = requests.get(image_url, timeout=60)
    response.raise_for_status()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_bytes(response.content)


def generate_login_hero(
    api_key: str,
    prompt: str,
    output_dir: Path,
    reference_images: list[str],
    image_count: int,
) -> list[Path]:
    """调用百炼生成主视觉，并把结果保存到前端可访问目录。"""
    response = MultiModalConversation.call(
        api_key=api_key,
        model='qwen-image-2.0',
        messages=build_messages(prompt=prompt, reference_images=reference_images),
        result_format='message',
        stream=False,
        n=image_count,
        watermark=False,
        negative_prompt=(
            '人物, 人脸, 手臂, 衣服, 模特, 文字, 字母, logo, 水印, UI 卡片, 弹窗,'
            '按钮, 表单, 低清晰度, 杂乱布局, 噪点, 低分辨率'
        ),
    )

    response_payload = normalize_response_payload(response)
    image_urls = extract_image_urls(response_payload)
    output_paths = build_output_paths(output_dir=output_dir, image_count=len(image_urls))

    for image_url, output_path in zip(image_urls, output_paths, strict=True):
        download_image(image_url=image_url, output_path=output_path)

    metadata_path = output_dir / 'latest-generation.json'
    metadata_path.write_text(
        json.dumps(
            {
                'prompt': prompt,
                'reference_images': reference_images,
                'image_urls': image_urls,
                'saved_paths': [str(path) for path in output_paths],
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding='utf-8',
    )

    return output_paths


def parse_args() -> argparse.Namespace:
    """解析命令行参数。"""
    parser = argparse.ArgumentParser(description='生成登录页右侧主视觉图')
    parser.add_argument(
        '--output-dir',
        default=str(Path(__file__).resolve().parents[1] / 'frontend' / 'public' / 'generated'),
        help='图片输出目录',
    )
    parser.add_argument(
        '--image-count',
        default=1,
        type=int,
        help='生成图片数量，默认只保留 1 张主图',
    )
    parser.add_argument(
        '--prompt',
        default=DEFAULT_PROMPT,
        help='可选的生成提示词',
    )
    return parser.parse_args()


def main() -> None:
    """读取环境变量并执行登录页主视觉生成。"""
    load_dotenv(Path(__file__).with_name('.env'))
    api_key = os.getenv('DASHSCOPE_API_KEY')
    if not api_key:
        raise RuntimeError('未在 .env 中读取到 DASHSCOPE_API_KEY')

    args = parse_args()
    output_paths = generate_login_hero(
        api_key=api_key,
        prompt=args.prompt,
        output_dir=Path(args.output_dir),
        reference_images=DEFAULT_REFERENCE_IMAGES,
        image_count=args.image_count,
    )

    for output_path in output_paths:
        print(output_path)


if __name__ == '__main__':
    main()
