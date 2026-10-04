"""Foreground app inspection without input interception; importable on other OSes."""
import os
from .model import Foreground


def foreground() -> Foreground:
    if os.name != 'nt':
        return Foreground()
    import ctypes
    from ctypes import wintypes
    user = ctypes.WinDLL('user32', use_last_error=True)
    kernel = ctypes.WinDLL('kernel32', use_last_error=True)
    user.GetForegroundWindow.restype = wintypes.HWND
    user.GetWindowThreadProcessId.argtypes = (wintypes.HWND, ctypes.POINTER(wintypes.DWORD))
    user.GetWindowTextW.argtypes = (wintypes.HWND, wintypes.LPWSTR, ctypes.c_int)
    kernel.OpenProcess.argtypes = (wintypes.DWORD, wintypes.BOOL, wintypes.DWORD)
    kernel.OpenProcess.restype = wintypes.HANDLE
    kernel.QueryFullProcessImageNameW.argtypes = (wintypes.HANDLE, wintypes.DWORD, wintypes.LPWSTR, ctypes.POINTER(wintypes.DWORD))
    kernel.CloseHandle.argtypes = (wintypes.HANDLE,)
    hwnd = user.GetForegroundWindow()
    if not hwnd:
        return Foreground()
    title = ctypes.create_unicode_buffer(4096)
    user.GetWindowTextW(hwnd, title, len(title))
    pid = wintypes.DWORD()
    user.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
    process = kernel.OpenProcess(0x1000, False, pid.value)
    if not process:
        return Foreground(title=title.value, hwnd=int(hwnd))
    try:
        path = ctypes.create_unicode_buffer(32768)
        size = wintypes.DWORD(len(path))
        if kernel.QueryFullProcessImageNameW(process, 0, path, ctypes.byref(size)):
            return Foreground(path.value.rsplit('\\', 1)[-1].lower(), title.value, int(hwnd))
        return Foreground(title=title.value, hwnd=int(hwnd))
    finally:
        kernel.CloseHandle(process)
