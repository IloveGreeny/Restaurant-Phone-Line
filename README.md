# Restaurant Phone Line — AI phone host for Qitchen

Restaurant Phone Line is a phone assistant for **Qitchen**, a small sushi restaurant in Portland. It answers calls, answers questions about hours, location and the menu, and books tables. Bookings go to **Calendly**.

## Features

- **Voice phone call in the browser.** Tap the green button to call. The assistant speaks (speech synthesis) and listens (speech recognition). In *Auto* mode the mic re-opens after every reply, so it works like a real call. You can also type.
- **Natural booking.** Callers can say everything at once ("a table for 4 next Friday at 7") or answer step by step. It understands words like *tomorrow*, *next Saturday*, *October 30th*, *half past six*, *noon* and *lunch*.
- **Business rules from Qitchen.** It knows the opening hours (every day, 12 PM – 9 PM, seatings every 30 minutes until 8:30 PM), the 6-guest limit for phone bookings, past dates and times, and the seating areas. When a requested time doesn't exist, it suggests the closest slots. Hours and seatings are set in `src/data/business.js`.
- **Typo-tolerant.** Misspellings such as *tommorow*, *fridy*, *reservaton* or *vegeterian*, and time formats like *5:30 p.m.*, *5.30pm* or *5:30 p,m* are understood. Names and emails are never auto-corrected.
- **Calendly integration.** After the caller confirms, the Calendly event opens inside the app. The caller's name, email, date and a booking note (party size, seating, allergies) are already filled in. When the booking is scheduled, Calendly sends a `calendly.event_scheduled` message and the staff log marks the booking *Confirmed*.
- **⭐ Custom feature: allergy-aware menu advisor.** The assistant recognises allergies and diets (shellfish, fish, gluten, dairy, egg, sesame, soy, vegetarian, vegan) anywhere in the call. It tells the caller which rolls are safe and flags the allergy on the booking and in the Calendly note, so the kitchen sees it before the guest arrives. Staff can also filter the menu by clicking allergen chips.
- **Staff view.** A log of bookings made by phone, with allergy warnings and callback requests.

## Getting started

```bash
npm install
npm run dev      # open the printed URL (usually http://localhost:5173)
npm test         # runs the conversation tests
```

Use **Chrome, Edge or Safari** for voice input. Firefox can only use the typed input. Allow microphone access when the browser asks.

## Connect Calendly

1. In Calendly, create an event type, for example **"Qitchen Table Reservation"** (15–30 min). Set its availability to the restaurant's seatings.
2. Under *Invitee questions*, add a custom question such as **"Booking notes"**. It must be the first custom question, because it receives the `a1` prefill.
3. Copy the event link (for example `https://calendly.com/qitchen/table-reservation`). Then do one of these:
   - paste it in the app under **Calendar settings**, or
   - copy `.env.example` to `.env` and set `VITE_CALENDLY_URL`.

This uses Calendly's free URL prefill and embed widget, so no API key is needed.

## Project structure

```
src/
  assistant/
    engine.js        conversation logic (intents, slot filling, confirmation)
    parsers.js       understands dates, times, guests, names, emails
    allergy.js       allergy-aware menu advisor
    engine.test.js   example calls used as tests
  calendly/calendly.js   prefill URL, booking note, embed loader
  hooks/useSpeech.js     speech recognition and speech synthesis
  components/            Phone, BookingCard, AllergyAdvisor, CalendlyPanel, CallLog, Settings
  data/                  Qitchen business info and menu (with allergen tags)
public/images/           sushi photos from the Qitchen site
```

## Notes

- Allergen tags are demo data based on the menu descriptions. The restaurant should check them with the kitchen.
- To take real phone calls, connect a telephony service such as Twilio or Vapi to the same `respond()` engine. The engine is a pure function, so it can run on a server as well.
