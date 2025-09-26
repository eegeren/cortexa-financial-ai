from fastapi import FastAPI
from pydantic import BaseModel
app = FastAPI()
class Req(BaseModel): symbol: str
@app.post("/predict")
def predict(r: Req): return {"symbol": r.symbol, "side": "BUY", "score": 0.72}
