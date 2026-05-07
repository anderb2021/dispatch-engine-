from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .database import Base

class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    created_at: Mapped[str] = mapped_column(DateTime(timezone=True), server_default=func.now())
    tesla_account = relationship("TeslaAccount", back_populates="user", uselist=False)

class TeslaAccount(Base):
    __tablename__ = "tesla_accounts"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True)
    access_token_encrypted: Mapped[str] = mapped_column(Text)
    refresh_token_encrypted: Mapped[str] = mapped_column(Text)
    expires_at: Mapped[int] = mapped_column(Integer)
    user = relationship("User", back_populates="tesla_account")

class Vehicle(Base):
    __tablename__ = "vehicles"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    tesla_vehicle_id: Mapped[str] = mapped_column(String(64), index=True)
    vin: Mapped[str | None] = mapped_column(String(64), nullable=True)
    display_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    charger_power_kw: Mapped[float] = mapped_column(Float, default=7.2)
    target_soc: Mapped[int] = mapped_column(Integer, default=80)
    ready_by: Mapped[str] = mapped_column(String(5), default="07:00")
    avoid_start: Mapped[str] = mapped_column(String(5), default="16:00")
    avoid_end: Mapped[str] = mapped_column(String(5), default="21:00")
    automation_enabled: Mapped[bool] = mapped_column(Boolean, default=False)

class ScheduleRun(Base):
    __tablename__ = "schedule_runs"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    vehicle_id: Mapped[int] = mapped_column(ForeignKey("vehicles.id"))
    current_soc: Mapped[int] = mapped_column(Integer)
    target_soc: Mapped[int] = mapped_column(Integer)
    start_time: Mapped[str] = mapped_column(String(5))
    stop_time: Mapped[str] = mapped_column(String(5))
    estimated_kwh: Mapped[float] = mapped_column(Float)
    estimated_savings: Mapped[float] = mapped_column(Float)
    command_status: Mapped[str] = mapped_column(String(64), default="planned")
    created_at: Mapped[str] = mapped_column(DateTime(timezone=True), server_default=func.now())
