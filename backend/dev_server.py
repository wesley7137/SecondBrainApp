import uvicorn
import logging
from pathlib import Path

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def run_server():
    # Get the absolute path to the backend directory
    backend_dir = Path(__file__).parent.absolute()
    
    config = uvicorn.Config(
        "server:app",  # Use the module:variable syntax
        host="0.0.0.0",
        port=8010,
        reload=True,
        reload_dirs=[str(backend_dir)],  # Watch the backend directory
        log_level="info"
    )
    server = uvicorn.Server(config)
    server.run()

if __name__ == "__main__":
    logger.info("Starting development server with auto-reload...")
    run_server() 