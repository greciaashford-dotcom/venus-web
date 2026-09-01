"""Programador ligero basado en asyncio + estado en Mongo (robusto ante reinicios).

- Reporte diario de estadísticas a la empresa (08:00 Europe/Madrid).
- Análisis SEO semanal con IA.
El bucle revisa cada 10 minutos si hay tareas pendientes.
"""
import asyncio
import logging
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from core.config import db

logger = logging.getLogger("ecoandes.scheduler")

MADRID = ZoneInfo("Europe/Madrid")
DAILY_REPORT_HOUR = 8
STATE_ID = "scheduler"


async def _get_state() -> dict:
    return await db.site_config.find_one({"_id": STATE_ID}) or {}


async def _set_state(patch: dict) -> None:
    await db.site_config.update_one({"_id": STATE_ID}, {"$set": patch}, upsert=True)


async def _maybe_daily_report() -> None:
    now = datetime.now(MADRID)
    if now.hour < DAILY_REPORT_HOUR:
        return
    today = now.strftime("%Y-%m-%d")
    state = await _get_state()
    if state.get("last_daily_report") == today:
        return
    from core.mailer import send_daily_report

    logger.info("Sending daily stats report (%s)", today)
    await send_daily_report()
    await _set_state({"last_daily_report": today})


async def _maybe_weekly_seo() -> None:
    state = await _get_state()
    last = state.get("last_seo_analysis")
    if last:
        try:
            last_dt = datetime.fromisoformat(last)
            if datetime.now(timezone.utc) - last_dt < timedelta(days=7):
                return
        except ValueError:
            pass
    from routes.seo import run_seo_analysis

    logger.info("Running weekly SEO analysis")
    await run_seo_analysis(trigger="weekly")
    await _set_state({"last_seo_analysis": datetime.now(timezone.utc).isoformat()})


async def _maybe_abandoned_carts() -> None:
    """Recordatorios de carrito abandonado (4h de inactividad, idempotente)."""
    from routes.carts import process_abandoned_carts

    await process_abandoned_carts()


async def scheduler_loop() -> None:
    await asyncio.sleep(30)  # let the app finish booting
    while True:
        try:
            await _maybe_daily_report()
        except Exception as e:  # noqa: BLE001
            logger.error("Daily report failed: %s", e)
        try:
            await _maybe_weekly_seo()
        except Exception as e:  # noqa: BLE001
            logger.error("Weekly SEO analysis failed: %s", e)
        try:
            await _maybe_abandoned_carts()
        except Exception as e:  # noqa: BLE001
            logger.error("Abandoned carts processing failed: %s", e)
        await asyncio.sleep(600)
