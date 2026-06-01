#!/usr/bin/env python3
"""
Game Weaver 一键启动脚本
运行此文件将自动启动开发服务器并打开浏览器
"""

import subprocess
import webbrowser
import time
import sys
import os
import socket

def is_port_open(port):
    """检查端口是否已开放"""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(1)
        return s.connect_ex(('localhost', port)) == 0

def wait_for_server(port, timeout=60):
    """等待服务器启动"""
    start = time.time()
    while time.time() - start < timeout:
        if is_port_open(port):
            return True
        time.sleep(0.5)
        print(".", end="", flush=True)
    return False

def main():
    project_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(project_dir)
    
    print("=" * 50)
    print("  Game Weaver 启动中...")
    print("=" * 50)
    
    # 检查 node_modules 是否存在
    if not os.path.exists(os.path.join(project_dir, "node_modules")):
        print("\n[1/3] 首次运行，正在安装依赖...")
        subprocess.run(["npm", "install"], shell=True, check=True)
    else:
        print("\n[1/3] 依赖已安装 ✓")
    
    print("\n[2/3] 启动 Next.js 开发服务器...")
    
    # 启动 Next.js 开发服务器（后台运行）
    if sys.platform == "win32":
        process = subprocess.Popen(
            ["npm", "run", "dev"],
            shell=True,
            cwd=project_dir,
            creationflags=subprocess.CREATE_NEW_PROCESS_GROUP
        )
    else:
        process = subprocess.Popen(
            ["npm", "run", "dev"],
            shell=True,
            cwd=project_dir
        )
    
    # 等待服务器启动
    print("\n[3/3] 等待服务器就绪", end="", flush=True)
    if wait_for_server(3030):
        print(" ✓")
    else:
        print("\n警告：服务器可能尚未完全启动")
    
    # 打开浏览器
    url = "http://localhost:3030"
    print(f"\n正在打开浏览器: {url}")
    webbrowser.open(url)
    
    print("\n" + "=" * 50)
    print("  ✓ 服务器已启动！")
    print("  访问地址: http://localhost:3030")
    print("  按 Ctrl+C 停止服务器")
    print("=" * 50)
    
    try:
        process.wait()
    except KeyboardInterrupt:
        print("\n\n正在关闭服务器...")
        process.terminate()
        print("已停止。")

if __name__ == "__main__":
    main()
