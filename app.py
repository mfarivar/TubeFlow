import os
import sys
import json
import subprocess
import threading

# Ensure common macOS executable directories are in the PATH.
# This is required when running as a packaged .app bundle launched from Finder,
# as macOS GUI apps do not inherit terminal shell PATH variables.
paths_to_add = ['/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin']
current_path = os.environ.get('PATH', '')
for path_dir in paths_to_add:
    if path_dir not in current_path:
        current_path = path_dir + os.pathsep + current_path
os.environ['PATH'] = current_path
import webview
import yt_dlp
from yt_dlp.utils import download_range_func

class TubeFlowAPI:
    def __init__(self):
        self.window = None
        self._cancelled = False
        self._download_thread = None

    def set_window(self, window):
        self.window = window

    def resize_window(self, height):
        """Dynamically resize the window height to fit content."""
        if self.window:
            # Clamp between min and max
            h = max(420, min(int(height), 700))
            try:
                w = self.window.width
            except Exception:
                w = 840
            self.window.resize(w, h)

    def get_video_info(self, url):
        """Fetches video metadata (Title, Thumbnail, Duration, Uploader) without downloading."""
        ydl_opts = {
            'nocheckcertificate': True,
            'quiet': True,
            'no_warnings': True,
            'noplaylist': True,
        }
        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=False)
                return {
                    'title': info.get('title'),
                    'thumbnail': info.get('thumbnail'),
                    'duration': info.get('duration'),
                    'uploader': info.get('uploader'),
                }
        except Exception as e:
            return {'error': str(e)}

    def download_media(self, url, format_type, start_time, end_time):
        """Starts the download process in a background thread."""
        self._cancelled = False
        self._download_thread = threading.Thread(
            target=self._download_worker,
            args=(url, format_type, start_time, end_time),
            daemon=True
        )
        self._download_thread.start()
        return True

    def cancel_download(self):
        """Signals the active download thread to cancel."""
        self._cancelled = True
        return True

    def get_download_folder(self):
        """Loads the configured download folder path, defaulting to ~/Downloads."""
        config_file = os.path.expanduser('~/.tubeflow_config.json')
        default_folder = os.path.expanduser('~/Downloads')
        if not os.path.exists(config_file):
            return default_folder
        try:
            with open(config_file, 'r', encoding='utf-8') as f:
                config = json.load(f)
                return config.get('download_folder', default_folder)
        except Exception:
            return default_folder

    def _save_download_folder(self, folder_path):
        """Saves the configured download folder path to the local config file."""
        config_file = os.path.expanduser('~/.tubeflow_config.json')
        try:
            config = {}
            if os.path.exists(config_file):
                with open(config_file, 'r', encoding='utf-8') as f:
                    config = json.load(f)
            config['download_folder'] = folder_path
            with open(config_file, 'w', encoding='utf-8') as f:
                json.dump(config, f, indent=2, ensure_ascii=False)
            return True
        except Exception:
            return False

    def select_download_folder(self):
        """Opens a native folder selection dialog and returns the chosen path, or None."""
        if not self.window:
            return None
        current_dir = self.get_download_folder()
        result = self.window.create_file_dialog(dialog_type=20, directory=current_dir)
        if result and len(result) > 0:
            chosen_path = result[0]
            self._save_download_folder(chosen_path)
            return chosen_path
        return None

    def get_history(self):
        """Loads and returns download history from the local JSON file."""
        history_file = os.path.expanduser('~/.tubeflow_history.json')
        if not os.path.exists(history_file):
            return []
        try:
            with open(history_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            return []

    def reveal_in_finder(self, filepath):
        """Reveals the downloaded file in Finder."""
        if os.path.exists(filepath):
            subprocess.run(["open", "-R", filepath])
            return True
        else:
            # Fallback: Open parent directory instead
            parent_dir = os.path.dirname(filepath)
            if os.path.exists(parent_dir):
                subprocess.run(["open", parent_dir])
                return True
        return False

    def remove_from_history(self, item_id):
        """Removes a single item from history."""
        history_file = os.path.expanduser('~/.tubeflow_history.json')
        if not os.path.exists(history_file):
            return False
        try:
            with open(history_file, 'r', encoding='utf-8') as f:
                history = json.load(f)
            history = [item for item in history if item.get('id') != item_id]
            with open(history_file, 'w', encoding='utf-8') as f:
                json.dump(history, f, indent=2, ensure_ascii=False)
            return True
        except Exception:
            return False

    def clear_history(self):
        """Clears all items in history."""
        history_file = os.path.expanduser('~/.tubeflow_history.json')
        try:
            with open(history_file, 'w', encoding='utf-8') as f:
                json.dump([], f, indent=2)
            return True
        except Exception:
            return False

    def get_clipboard(self):
        """Reads and returns the system clipboard text using pbpaste on macOS."""
        try:
            result = subprocess.run(['pbpaste'], capture_output=True, text=True, check=True)
            return result.stdout.strip()
        except Exception:
            return ""

    def _add_to_history(self, title, filename, filepath, url, format_type):
        """Helper to append a successful download to the history file."""
        history_file = os.path.expanduser('~/.tubeflow_history.json')
        history = []
        if os.path.exists(history_file):
            try:
                with open(history_file, 'r', encoding='utf-8') as f:
                    history = json.load(f)
            except Exception:
                pass
        
        import time
        new_item = {
            'id': str(time.time()),
            'title': title,
            'filename': filename,
            'filepath': filepath,
            'url': url,
            'format': format_type,
            'timestamp': int(time.time())
        }
        
        # Newest items first
        history.insert(0, new_item)
        
        try:
            with open(history_file, 'w', encoding='utf-8') as f:
                json.dump(history, f, indent=2, ensure_ascii=False)
            return True
        except Exception:
            return False

    def open_downloads_folder(self):
        """Opens the macOS Downloads folder in Finder."""
        downloads_dir = self.get_download_folder()
        if os.path.exists(downloads_dir):
            subprocess.run(['open', downloads_dir])
            return True
        return False

    def _download_worker(self, url_or_urls, format_type, start_time, end_time):
        downloads_dir = self.get_download_folder()
        os.makedirs(downloads_dir, exist_ok=True)

        urls = url_or_urls if isinstance(url_or_urls, list) else [url_or_urls]
        total_items = len(urls)
        
        current_idx = 1
        failed_items = []
        last_success_filename = ""

        for idx, url in enumerate(urls):
            if self._cancelled:
                break
                
            current_idx = idx + 1
            
            def progress_hook(d):
                if self._cancelled:
                    raise yt_dlp.utils.DownloadCancelled('User cancelled')

                if d['status'] == 'downloading':
                    total = d.get('total_bytes') or d.get('total_bytes_estimate') or 0
                    downloaded = d.get('downloaded_bytes') or 0
                    
                    percent = 0
                    if total > 0:
                        percent = int((downloaded / total) * 100)
                    
                    speed = d.get('speed')
                    speed_str = "0 MB/s"
                    if speed:
                        if speed > 1024 * 1024:
                            speed_str = f"{speed / (1024 * 1024):.1f} MB/s"
                        else:
                            speed_str = f"{speed / 1024:.1f} KB/s"

                    eta = d.get('eta')
                    eta_str = "--:--"
                    if eta:
                        m, s = divmod(eta, 60)
                        h, m = divmod(m, 60)
                        if h > 0:
                            eta_str = f"{h:d}:{m:02d}:{s:02d}"
                        else:
                            eta_str = f"{m:02d}:{s:02d}"

                    self.window.evaluate_js(
                        f"window.updateProgress({percent}, {json.dumps(speed_str)}, {json.dumps(eta_str)}, {current_idx}, {total_items})"
                    )

            def postprocessor_hook(d):
                if self._cancelled:
                    raise yt_dlp.utils.DownloadCancelled('User cancelled')
                
                if d['status'] == 'started':
                    status_text = f"Processing item {current_idx} of {total_items}..." if total_items > 1 else "Processing files..."
                    self.window.evaluate_js(f"document.getElementById('dl-status-title').innerText = {json.dumps(status_text)}")

            ydl_opts = {
                'nocheckcertificate': True,
                'progress_hooks': [progress_hook],
                'postprocessor_hooks': [postprocessor_hook],
                'quiet': True,
                'no_warnings': True,
                'noplaylist': True,
                'overwrites': True,
            }

            if start_time is not None and end_time is not None:
                ydl_opts['download_ranges'] = download_range_func(None, [(start_time, end_time)])
                ydl_opts['force_keyframes_at_cuts'] = True

            is_tiktok = 'tiktok.com' in url.lower()

            if start_time is not None and end_time is not None:
                def format_time_str(seconds):
                    h, remainder = divmod(int(seconds), 3600)
                    m, s = divmod(remainder, 60)
                    parts = []
                    if h > 0:
                        parts.append(f"{h}h")
                    if m > 0 or h > 0:
                        parts.append(f"{m}m")
                    parts.append(f"{s}s")
                    return "".join(parts)
                
                trim_suffix = f" (trim {format_time_str(start_time)}-{format_time_str(end_time)})"
                outtmpl = os.path.join(downloads_dir, f'%(title)s{trim_suffix}.%(ext)s')
            else:
                outtmpl = os.path.join(downloads_dir, '%(title)s.%(ext)s')

            if format_type == 'audio':
                audio_format = 'bestaudio/best'
                if is_tiktok:
                    audio_format = 'best[vcodec*=h264]/bestaudio/best'
                ydl_opts.update({
                    'format': audio_format,
                    'outtmpl': outtmpl,
                    'writethumbnail': True,
                    'postprocessors': [
                        {
                            'key': 'FFmpegExtractAudio',
                            'preferredcodec': 'mp3',
                            'preferredquality': '192',
                        },
                        {
                            'key': 'EmbedThumbnail',
                        }
                    ]
                })
            else: # video
                video_format = 'bestvideo+bestaudio/best'
                if is_tiktok:
                    video_format = 'best[vcodec*=h264]/best'
                ydl_opts.update({
                    'format': video_format,
                    'merge_output_format': 'mp4',
                    'outtmpl': outtmpl,
                })

            try:
                status_title = f"Downloading item {current_idx} of {total_items}" if total_items > 1 else "Downloading..."
                self.window.evaluate_js(f"document.getElementById('dl-status-title').innerText = {json.dumps(status_title)}")

                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    info = ydl.extract_info(url, download=True)
                    
                    filepath = info.get('_filename')
                    if info.get('requested_downloads'):
                        filepath = info['requested_downloads'][0].get('filepath', filepath)

                    base, _ = os.path.splitext(filepath)
                    if format_type == 'audio':
                        final_path = base + '.mp3'
                    else:
                        final_path = base + '.mp4'
                    
                    final_filename = os.path.basename(final_path)
                    last_success_filename = final_filename

                    self._add_to_history(
                        title=info.get('title', final_filename),
                        filename=final_filename,
                        filepath=final_path,
                        url=url,
                        format_type=format_type
                    )
            except yt_dlp.utils.DownloadCancelled:
                self.window.evaluate_js("window.updateProgress(0, '0 MB/s', '--:--')")
                return
            except Exception as e:
                failed_items.append((url, str(e)))

        if self._cancelled:
            self.window.evaluate_js("window.updateProgress(0, '0 MB/s', '--:--')")
            return

        if failed_items:
            if len(failed_items) == total_items:
                err_msg = f"All {total_items} downloads failed. Details: {failed_items[0][1]}"
                self.window.evaluate_js(f"window.downloadFailed({json.dumps(err_msg)})")
            else:
                msg = f"Completed with warnings. {len(failed_items)} of {total_items} downloads failed."
                self.window.evaluate_js(f"window.downloadComplete({json.dumps(msg)})")
        else:
            if total_items > 1:
                success_msg = f"Successfully downloaded all {total_items} files!"
                self.window.evaluate_js(f"window.downloadComplete({json.dumps(success_msg)})")
            else:
                self.window.evaluate_js(f"window.downloadComplete({json.dumps(last_success_filename)})")


def main():
    # Resolve the web directory path
    if hasattr(sys, '_MEIPASS'):
        web_dir = os.path.join(sys._MEIPASS, 'web')
    else:
        current_dir = os.path.dirname(os.path.abspath(__file__))
        web_dir = os.path.join(current_dir, 'web')
        
    html_file = os.path.join(web_dir, 'index.html')

    api = TubeFlowAPI()
    
    # Create the native macOS desktop window
    window = webview.create_window(
        title='TubeFlow Downloader',
        url=html_file,
        js_api=api,
        width=840,
        height=480,
        min_size=(680, 420),
        resizable=True,
        background_color='#0d0e12'
    )
    
    api.set_window(window)
    
    # Start the app
    webview.start(debug=False)


if __name__ == '__main__':
    main()
