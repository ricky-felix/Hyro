"""Background scheduler — port of ``src/scheduler/scheduler.service.ts``.

Uses APScheduler with crontab triggers (overridable via env). Started/stopped
from the FastAPI lifespan in ``main.py``.
"""
import logging

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from .common.utils import utc_now
from .config import settings

logger = logging.getLogger("scheduler")

_scheduler: BackgroundScheduler = None  # type: ignore[assignment]


def _materialize_recurring_bills() -> None:
    from .recurring_bills.service import RecurringBillsService

    logger.info("Starting: materialize due recurring bills")
    try:
        result = RecurringBillsService().materialize_due(utc_now())
        logger.info(
            "Completed: materialize recurring bills — created=%s",
            result.get("created"),
        )
    except Exception:
        logger.exception("Failed: materialize recurring bills")


def _expire_due_subscriptions() -> None:
    from .subscriptions.service import SubscriptionsService

    logger.info("Starting: expire due subscriptions")
    try:
        result = SubscriptionsService().expire_due(utc_now())
        logger.info(
            "Completed: expire due subscriptions — expired_count=%s",
            result.get("expired_count"),
        )
    except Exception:
        logger.exception("Failed: expire due subscriptions")


def _send_payment_reminders() -> None:
    from .notifications.service import NotificationsService

    logger.info("Starting: send payment reminders")
    try:
        result = NotificationsService().create_payment_reminders(utc_now())
        logger.info(
            "Completed: send payment reminders — created=%s", result.get("created")
        )
    except Exception:
        logger.exception("Failed: send payment reminders")


def start_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        return
    _scheduler = BackgroundScheduler(timezone="UTC")
    _scheduler.add_job(
        _materialize_recurring_bills,
        CronTrigger.from_crontab(settings.CRON_MATERIALIZE_BILLS),
        id="materialize-recurring-bills",
    )
    _scheduler.add_job(
        _expire_due_subscriptions,
        CronTrigger.from_crontab(settings.CRON_EXPIRE_SUBSCRIPTIONS),
        id="expire-due-subscriptions",
    )
    _scheduler.add_job(
        _send_payment_reminders,
        CronTrigger.from_crontab(settings.CRON_PAYMENT_REMINDERS),
        id="send-payment-reminders",
    )
    _scheduler.start()


def shutdown_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None
