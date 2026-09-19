from pydantic import BaseModel
from typing import Optional

class StationBase(BaseModel):
    name: str
    city_he: str
    city_en: str
    address: str
    brand: str
    price_ils: Optional[float] = None
    last_updated: Optional[str] = None
    status: Optional[str] = None
    on_highway: Optional[bool] = False
    source_refs: Optional[str] = None
    lat: float
    lng: float
    comment: Optional[str] = None

class StationCreate(StationBase):
    pass

class StationUpdate(StationBase):
    pass

class StationResponse(StationBase):
    class Config:
        from_attributes = True
