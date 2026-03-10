import asyncio
import logging
import os
import json
import aiohttp
from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.filters import CommandStart, Command
from aiogram.types import Message
from apscheduler.schedulers.asyncio import AsyncIOScheduler

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Constants
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
BACKEND_URL = os.getenv("BACKEND_URL", "http://backend:3000")
CRITICAL_LEVEL = float(os.getenv("CRITICAL_LEVEL", 200.0))
SENSOR_ID = int(os.getenv("SENSOR_ID", 1))

SUBSCRIBERS_FILE = "/app/data/subscribers.json"

# Initialize bot and dp
if not TELEGRAM_BOT_TOKEN:
    raise ValueError("TELEGRAM_BOT_TOKEN is not set.")

bot = Bot(token=TELEGRAM_BOT_TOKEN, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
dp = Dispatcher()
scheduler = AsyncIOScheduler()

def load_subscribers() -> set:
    if os.path.exists(SUBSCRIBERS_FILE):
        try:
            with open(SUBSCRIBERS_FILE, "r") as f:
                return set(json.load(f))
        except Exception as e:
            logger.error(f"Error loading subscribers: {e}")
    return set()

def save_subscribers(subs: set):
    os.makedirs(os.path.dirname(SUBSCRIBERS_FILE), exist_ok=True)
    try:
        with open(SUBSCRIBERS_FILE, "w") as f:
            json.dump(list(subs), f)
    except Exception as e:
        logger.error(f"Error saving subscribers: {e}")

subscribers = load_subscribers()

# Add TELEGRAM_CHAT_ID from env if present
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID")
if TELEGRAM_CHAT_ID:
    try:
        subscribers.add(int(TELEGRAM_CHAT_ID))
        save_subscribers(subscribers)
    except ValueError:
        pass

async def broadcast_message(text: str):
    """Sends a message to all subscribed chats."""
    subs = load_subscribers()
    if not subs:
        logger.warning(f"No subscribers to broadcast to. Message: {text}")
        return
        
    for chat_id in subs:
        try:
            await bot.send_message(chat_id=chat_id, text=text)
        except Exception as e:
            logger.error(f"Failed to send message to {chat_id}: {e}")

async def check_predictions_and_alert(manual_chat_id: int | str | None = None):
    """Fetches new predictions from backend, alerts if ANY predicted value > CRITICAL_LEVEL."""
    logger.info("Executing periodic flood prediction check...")
    try:
        async with aiohttp.ClientSession() as session:
            # Tell backend to regenerate forecast
            async with session.post(f"{BACKEND_URL}/api/forecast", json={"sensorId": SENSOR_ID}) as resp:
                if resp.status != 200:
                    logger.error(f"Failed to fetch forecast. API returned {resp.status}")
                    if manual_chat_id:
                        await bot.send_message(manual_chat_id, f"❌ Ошибка получения прогноза (код {resp.status})")
                    return
                
                data = await resp.json()
                if not data.get("success"):
                    logger.error(f"Forecast API returned success=false: {data.get('error')}")
                    if manual_chat_id:
                        await bot.send_message(manual_chat_id, f"❌ Ошибка вычисления прогноза: {data.get('error')}")
                    return

                forecast_data = data["forecast"]["forecastData"]
                
                # Format forecast lines
                forecast_lines = "\n".join([f"• Через {p['horizon']} ч: <b>{p['yhat']:.1f} см</b>" for p in forecast_data])
                
                # Check for critical predictions
                critical_points = [p for p in forecast_data if p["yhat"] > CRITICAL_LEVEL]

                if critical_points:
                    msg = (
                        "🚨 <b>ВНИМАНИЕ! Угроза паводка!</b> 🚨\n\n"
                        f"Прогнозируемый уровень воды превысит отметку {CRITICAL_LEVEL} см.\n\n"
                        "<b>Прогноз:</b>\n"
                        f"{forecast_lines}"
                    )
                    
                    if manual_chat_id:
                        await bot.send_message(chat_id=manual_chat_id, text=msg)
                    else:
                        await broadcast_message(msg)
                else:
                    msg = (
                        "📊 <b>Текущий прогноз уровня воды:</b>\n\n"
                        f"{forecast_lines}\n\n"
                        "Уровень в пределах нормы. ✅"
                    )
                    if manual_chat_id:
                        await bot.send_message(chat_id=manual_chat_id, text=msg)
                    logger.info("Forecast check completed: No flood risk detected.")
    except Exception as e:
        logger.exception(f"Error checking predictions: {e}")
        if manual_chat_id:
            await bot.send_message(manual_chat_id, "❌ Произошла ошибка при проверке прогноза.")

@dp.message(CommandStart())
async def command_start_handler(message: Message) -> None:
    chat_id = message.chat.id
    if chat_id not in subscribers:
        subscribers.add(chat_id)
        save_subscribers(subscribers)
        
    await message.answer(
        "Привет! Я бот-мониторинга уровня реки Кача 🌊\n\n"
        "✅ Вы успешно подписались на автоматические уведомления. "
        f"Я буду присылать предупреждения в этот чат, если прогнозируемый уровень воды "
        f"превысит {CRITICAL_LEVEL} см.\n\n"
        "Используйте команду /check для ручной проверки текущего прогноза."
    )

@dp.message(Command("check"))
async def check_command_handler(message: Message) -> None:
    chat_id = message.chat.id
    if chat_id not in subscribers:
        subscribers.add(chat_id)
        save_subscribers(subscribers)
        
    await message.answer("Запускаю пересчет прогноза и загружаю результаты...")
    await check_predictions_and_alert(manual_chat_id=message.chat.id)

async def main():
    # Setup scheduler for fetching data
    scheduler.add_job(check_predictions_and_alert, 'interval', seconds=30)
    scheduler.start()
    
    # Run bot
    await dp.start_polling(bot)

if __name__ == "__main__":
    asyncio.run(main())
