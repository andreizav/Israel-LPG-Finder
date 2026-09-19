from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List

from database import get_db
import models, schemas

router = APIRouter(prefix="/api/stations", tags=["stations"])

@router.get("", response_model=List[schemas.StationResponse])
async def get_stations(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.Station))
    stations = result.scalars().all()
    return stations

@router.get("/{name}", response_model=schemas.StationResponse)
async def get_station(name: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.Station).where(models.Station.name == name))
    station = result.scalars().first()
    if not station:
        raise HTTPException(status_code=404, detail="Station not found")
    return station

@router.post("", response_model=schemas.StationResponse)
async def create_station(station: schemas.StationCreate, db: AsyncSession = Depends(get_db)):
    # Check if exists
    result = await db.execute(select(models.Station).where(models.Station.name == station.name))
    existing = result.scalars().first()
    if existing:
        raise HTTPException(status_code=400, detail="Station already exists")
    
    db_station = models.Station(**station.model_dump())
    db.add(db_station)
    await db.commit()
    await db.refresh(db_station)
    return db_station

@router.put("/{name}", response_model=schemas.StationResponse)
async def update_station(name: str, station: schemas.StationUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.Station).where(models.Station.name == name))
    db_station = result.scalars().first()
    if not db_station:
        raise HTTPException(status_code=404, detail="Station not found")
    
    update_data = station.model_dump(exclude_unset=True)
    # If the name is changed, we need to handle it. Actually, since name is primary key, it's complex.
    # We will just update fields for now.
    for key, value in update_data.items():
        setattr(db_station, key, value)
    
    await db.commit()
    await db.refresh(db_station)
    return db_station

@router.delete("/{name}")
async def delete_station(name: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.Station).where(models.Station.name == name))
    db_station = result.scalars().first()
    if not db_station:
        raise HTTPException(status_code=404, detail="Station not found")
    
    await db.delete(db_station)
    await db.commit()
    return {"ok": True}
