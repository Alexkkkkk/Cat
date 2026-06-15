from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import uvicorn

app = FastAPI()

# Раздача статики (index.html, картинки)
app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/")
async def read_index():
    return FileResponse('static/index.html')

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=3000)
