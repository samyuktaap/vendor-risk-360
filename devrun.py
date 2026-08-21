import subprocess
import sys
import os
import time
import signal

def run_servers():
    print("[INFO] Starting VendorRisk 360 Development Servers...")

    # Paths
    root_dir = os.path.dirname(os.path.abspath(__file__))
    backend_dir = os.path.join(root_dir, "backend")
    frontend_dir = os.path.join(root_dir, "frontend")

    # Start Backend FastAPI
    backend_cmd = [sys.executable, "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload", "--workers", "1"]
    print(f"[INFO] Starting backend in: {backend_dir}")
    backend_process = subprocess.Popen(
        backend_cmd,
        cwd=backend_dir,
        creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if os.name == 'nt' else 0
    )

    # Start Frontend Vite (using cmd /c npm run dev on Windows to bypass ExecutionPolicy)
    if os.name == 'nt':
        frontend_cmd = "cmd /c npm run dev -- --port 5173"
    else:
        frontend_cmd = "npm run dev -- --port 5173"
        
    print(f"[INFO] Starting frontend in: {frontend_dir}")
    frontend_process = subprocess.Popen(
        frontend_cmd,
        cwd=frontend_dir,
        shell=True,
        creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if os.name == 'nt' else 0
    )

    print("\n[SUCCESS] Both servers are starting up.")
    print("   - Backend API: http://localhost:8000")
    print("   - Frontend App: http://localhost:5173")
    print("Press Ctrl+C to stop both servers.\n")

    try:
        # Keep the script running and monitor processes
        while True:
            time.sleep(1)
            # Check if any process terminated early
            if backend_process.poll() is not None:
                print("[ERROR] Backend server stopped unexpectedly.")
                break
            if frontend_process.poll() is not None:
                print("[ERROR] Frontend server stopped unexpectedly.")
                break
    except KeyboardInterrupt:
        print("\n[INFO] Shutting down development servers...")
    finally:
        # Clean termination
        if os.name == 'nt':
            # Send CTRL_BREAK_EVENT to process groups on Windows
            backend_process.send_signal(signal.CTRL_BREAK_EVENT)
            frontend_process.send_signal(signal.CTRL_BREAK_EVENT)
        else:
            backend_process.terminate()
            frontend_process.terminate()

        # Wait for shutdown
        backend_process.wait()
        frontend_process.wait()
        print("[INFO] All servers stopped.")

if __name__ == "__main__":
    run_servers()
