"""FastAPI application entrypoint — port of ``src/main.ts`` + ``app.module.ts``.

Global ``/api`` prefix for every router EXCEPT the payment-gateway webhooks,
which live at ``/webhooks/*`` so their URLs match what Xendit/Midtrans call.
"""
import logging
from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .common.utils import iso_now
from .config import settings
from .scheduler import shutdown_scheduler, start_scheduler

# ── Routers ──────────────────────────────────────────────────────────
from .users.router import router as users_router
from .users.payment_methods_router import router as payment_methods_router
from .groups.router import router as groups_router
from .group_members.router import router as group_members_router
from .rounds.router import router as rounds_router
from .payments.router import router as payments_router
from .invite_links.router import router as invite_links_router
from .notifications.router import router as notifications_router
from .bills.router import router as bills_router
from .bill_participants.router import router as bill_participants_router
from .bill_settlements.router import router as bill_settlements_router
from .bill_comments.router import router as bill_comments_router
from .recurring_bills.router import router as recurring_bills_router
from .debt_simplifications.router import router as debt_simplifications_router
from .plans.router import router as plans_router
from .subscriptions.router import router as subscriptions_router
from .payment_transactions.router import router as payment_transactions_router
from .usage.router import router as usage_router
from .contacts.router import router as contacts_router
from .storage.router import router as storage_router

# Webhooks (mounted WITHOUT the /api prefix)
from .billing.xendit_webhook import router as xendit_webhook_router
from .billing.midtrans_webhook import router as midtrans_webhook_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("app")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    start_scheduler()
    logger.info("Backend running on http://localhost:%s/api", settings.PORT)
    yield
    shutdown_scheduler()


app = FastAPI(title="Arisan Digital Backend API", lifespan=lifespan)

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(_request: Request, exc: RequestValidationError):
    """Mirror NestJS ValidationPipe: malformed request bodies return 400, not 422."""
    return JSONResponse(
        status_code=400,
        content={
            "statusCode": 400,
            "message": [str(e.get("msg", "")) for e in exc.errors()],
            "error": "Bad Request",
        },
    )


app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── /api router ──────────────────────────────────────────────────────
api = APIRouter(prefix="/api")


@api.get("/health")
def health():
    return {"status": "ok", "timestamp": iso_now()}


for r in (
    users_router,
    payment_methods_router,
    groups_router,
    group_members_router,
    rounds_router,
    payments_router,
    invite_links_router,
    notifications_router,
    bills_router,
    bill_participants_router,
    bill_settlements_router,
    bill_comments_router,
    recurring_bills_router,
    debt_simplifications_router,
    plans_router,
    subscriptions_router,
    payment_transactions_router,
    usage_router,
    contacts_router,
    storage_router,
):
    api.include_router(r)

app.include_router(api)

# Public, gateway-facing webhooks — no /api prefix.
app.include_router(xendit_webhook_router)
app.include_router(midtrans_webhook_router)
