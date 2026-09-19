from sqlalchemy import Column, Integer, String, Float, Boolean
from database import Base

class Station(Base):
    __tablename__ = "stations"

    name = Column(String, primary_key=True, index=True)
    city_he = Column(String, index=True)
    city_en = Column(String, index=True)
    address = Column(String)
    brand = Column(String, index=True)
    price_ils = Column(Float, nullable=True)
    last_updated = Column(String, nullable=True)
    status = Column(String, nullable=True)
    on_highway = Column(Boolean, default=False)
    source_refs = Column(String, nullable=True)
    lat = Column(Float)
    lng = Column(Float)
    comment = Column(String, nullable=True)
