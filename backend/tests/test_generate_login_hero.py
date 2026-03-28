from pathlib import Path

import pytest

from generate_login_hero import (
    build_messages,
    build_output_paths,
    extract_image_urls,
)


def test_build_messages_preserves_reference_images_and_prompt():
    messages = build_messages(
        prompt='抽象科技感登录页主视觉',
        reference_images=['https://example.com/1.png', 'https://example.com/2.png'],
    )

    assert messages == [
        {
            'role': 'user',
            'content': [
                {'image': 'https://example.com/1.png'},
                {'image': 'https://example.com/2.png'},
                {'text': '抽象科技感登录页主视觉'},
            ],
        }
    ]


def test_extract_image_urls_reads_urls_from_message_content():
    response_payload = {
        'output': {
            'choices': [
                {
                    'message': {
                        'content': [
                            {'image': 'https://example.com/hero-1.png'},
                            {'text': 'ignored'},
                            {'image': 'https://example.com/hero-2.png'},
                        ]
                    }
                }
            ]
        }
    }

    assert extract_image_urls(response_payload) == [
        'https://example.com/hero-1.png',
        'https://example.com/hero-2.png',
    ]


def test_extract_image_urls_raises_when_response_has_no_images():
    with pytest.raises(ValueError, match='未从百炼响应中解析到图片地址'):
        extract_image_urls({'output': {'choices': [{'message': {'content': []}}]}})


def test_build_output_paths_uses_stable_login_hero_names(tmp_path: Path):
    paths = build_output_paths(tmp_path, image_count=2)

    assert [path.name for path in paths] == ['login-hero-1.png', 'login-hero-2.png']
