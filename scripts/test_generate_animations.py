"""Checks that do not submit paid jobs or require API credentials."""
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import Mock, patch
from urllib.error import URLError
from urllib.request import Request

import generate_animations as video


class VideoPipelineTests(unittest.TestCase):
    def test_every_state_uses_same_waist_up_frame(self):
        config = video.read_json(video.CONFIG)
        model = {'id': video.MODEL, 'supported_durations': [5],
                 'supported_resolutions': ['768p'], 'supported_aspect_ratios': ['4:3'],
                 'supported_frame_images': ['first_frame']}
        requests = [video.build_request(config, name, model, 'https://example.com/bust.png', '768p')
                    for name in config['animations']]
        self.assertEqual(set(config['animations']), {'welcome', 'idle', 'spin', 'win', 'loss'})
        self.assertTrue(all(r['frame_images'] == requests[0]['frame_images'] for r in requests))
        self.assertTrue(all(r['aspect_ratio'] == '4:3' for r in requests))
        self.assertTrue(all(r['prompt'].startswith(config['common_prompt']) for r in requests))
        with self.assertRaises(video.VideoError):
            video.build_request(config, 'idle', model, 'https://example.com/bust.png', '8K')

    def test_heygen_audio_is_enabled_even_when_catalog_flag_is_false(self):
        # Regression: the provider rejected generate_audio=False with HTTP 400.
        model = {'id': video.MODEL, 'generate_audio': False,
                 'supported_durations': [5], 'supported_resolutions': ['768p'],
                 'supported_aspect_ratios': ['4:3'], 'supported_frame_images': ['first_frame']}
        config = video.read_json(video.CONFIG)
        for name in config['animations']:
            request = video.build_request(config, name, model, 'https://example.com/bust.png', '768p')
            self.assertIs(request['generate_audio'], True)

    def test_api_url_does_not_forward_key_to_other_hosts_or_paths(self):
        for url in ['https://example.com/api/v1/videos/a', 'http://openrouter.ai/api/v1/videos',
                    'https://openrouter.ai/api/v1/videos-fake']:
            with self.assertRaises(video.VideoError):
                video.api_url(url)
        self.assertEqual(video.api_url('/api/v1/videos/a'), video.API + '/videos/a')

    def test_redirect_to_cdn_drops_authorization(self):
        request = Request(video.API + '/videos/a/content', headers={'Authorization': 'Bearer test-only'})
        redirected = video.SafeRedirect().redirect_request(request, None, 302, 'Found', {}, 'https://cdn.example.com/a.mp4')
        self.assertIsNone(redirected.get_header('Authorization'))
        with self.assertRaises(video.VideoError):
            video.SafeRedirect().redirect_request(request, None, 302, 'Found', {}, 'http://cdn.example.com/a.mp4')

    def test_submission_transport_error_is_never_retried(self):
        client = video.Client('test-only')
        client.opener = Mock()
        client.opener.open.side_effect = URLError('offline')
        with self.assertRaisesRegex(video.VideoError, 'NOT retried'):
            client.json(video.API + '/videos', method='POST', payload={})
        self.assertEqual(client.opener.open.call_count, 1)

    def test_failed_job_is_saved_and_stops(self):
        client = Mock()
        client.json.return_value = {'id': 'job-1', 'status': 'failed', 'error': 'test failure'}
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'job.json'
            with self.assertRaisesRegex(video.VideoError, 'Generation failed'):
                video.wait_for_job(client, {'id': 'job-1', 'status': 'pending'}, path, interval=0)
            self.assertEqual(video.read_json(path)['status'], 'failed')
            client.json.assert_called_once_with(video.API + '/videos/job-1')

    def test_env_preserves_exports_and_does_not_execute(self):
        with tempfile.TemporaryDirectory() as directory, patch.dict(os.environ, {'TEST_VALUE': 'exported'}, clear=True):
            path = Path(directory) / '.env'
            path.write_text('TEST_VALUE=file\nexport TEST_LITERAL="$(do-not-execute)"\n')
            video.load_env(path)
            self.assertEqual(os.environ['TEST_VALUE'], 'exported')
            self.assertEqual(os.environ['TEST_LITERAL'], '$(do-not-execute)')


if __name__ == '__main__':
    unittest.main()
