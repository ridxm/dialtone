export type BusinessType =
  | "bakery"
  | "restaurant"
  | "cafe"
  | "salon"
  | "barbershop"
  | "spa"
  | "dental"
  | "medical"
  | "fitness"
  | "retail"
  | "professional"
  | "other";

export interface Business {
  id: string;
  name: string;
  url: string;
  business_type: BusinessType | null;
  services: string[];
  hours: string | null;
  location: string | null;
  pricing: string | null;
  policies: string | null;
  raw_html: Record<string, unknown>;
  vapi_assistant_id: string | null;
  created_at: string;
}

export interface Call {
  id: string;
  business_id: string | null;
  caller_type: string | null;
  transcript: string | null;
  summary: string | null;
  duration_seconds: number | null;
  intent: string | null;
  outcome: string | null;
  extracted_data: Record<string, unknown> | null;
  created_at: string;
}

export interface Booking {
  id: string;
  business_id: string | null;
  customer_name: string;
  customer_phone: string | null;
  service: string | null;
  date: string;
  time: string;
  status: "confirmed" | "cancelled" | "rescheduled";
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Inquiry {
  id: string;
  business_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  question: string;
  notes: string | null;
  created_at: string;
}

// Dashboard label config per business type
export const BUSINESS_TYPE_CONFIG: Record<BusinessType, {
  bookingLabel: string;
  bookingLabelPlural: string;
  customerWord: string;
  greeting: string;
  bookingPrompt: string;
}> = {
  bakery: {
    bookingLabel: "ORDER",
    bookingLabelPlural: "ORDERS",
    customerWord: "customer",
    greeting: "Thanks for calling! Looking to place an order, or do you have a question?",
    bookingPrompt: "Help customers place orders for pickup or delivery. Ask what items they'd like, when they need them, and their name. Mention popular items if asked.",
  },
  restaurant: {
    bookingLabel: "RESERVATION",
    bookingLabelPlural: "RESERVATIONS",
    customerWord: "guest",
    greeting: "Thanks for calling! Would you like to make a reservation, or do you have a question?",
    bookingPrompt: "Help guests make, change, or cancel reservations. Ask for party size, preferred date/time, and name. Mention specials if relevant.",
  },
  cafe: {
    bookingLabel: "ORDER",
    bookingLabelPlural: "ORDERS",
    customerWord: "customer",
    greeting: "Thanks for calling! Looking to place an order or have a question?",
    bookingPrompt: "Help customers with orders for pickup. Ask what they'd like and when they need it.",
  },
  salon: {
    bookingLabel: "APPOINTMENT",
    bookingLabelPlural: "APPOINTMENTS",
    customerWord: "client",
    greeting: "Thanks for calling! Looking to book an appointment?",
    bookingPrompt: "Help clients book, reschedule, or cancel appointments. Ask what service they'd like (cut, color, style, etc.), their preferred date and time, and their name.",
  },
  barbershop: {
    bookingLabel: "APPOINTMENT",
    bookingLabelPlural: "APPOINTMENTS",
    customerWord: "client",
    greeting: "Thanks for calling! Want to book an appointment?",
    bookingPrompt: "Help clients book, reschedule, or cancel appointments. Ask what cut or service they want, preferred date/time, and name.",
  },
  spa: {
    bookingLabel: "APPOINTMENT",
    bookingLabelPlural: "APPOINTMENTS",
    customerWord: "client",
    greeting: "Thanks for calling! Would you like to book a treatment?",
    bookingPrompt: "Help clients book spa treatments and services. Ask what treatment they're interested in, preferred date/time, and name.",
  },
  dental: {
    bookingLabel: "APPOINTMENT",
    bookingLabelPlural: "APPOINTMENTS",
    customerWord: "patient",
    greeting: "Thanks for calling! Are you looking to schedule an appointment?",
    bookingPrompt: "Help patients schedule, reschedule, or cancel dental appointments. Ask what type of visit (cleaning, checkup, emergency), preferred date/time, and name. Be reassuring.",
  },
  medical: {
    bookingLabel: "APPOINTMENT",
    bookingLabelPlural: "APPOINTMENTS",
    customerWord: "patient",
    greeting: "Thanks for calling! Are you looking to schedule an appointment?",
    bookingPrompt: "Help patients schedule, reschedule, or cancel appointments. Ask what type of visit, preferred date/time, and name. Be professional and reassuring.",
  },
  fitness: {
    bookingLabel: "CLASS",
    bookingLabelPlural: "CLASSES",
    customerWord: "member",
    greeting: "Thanks for calling! Looking to book a class or have a question?",
    bookingPrompt: "Help members book classes or personal training sessions. Ask which class/trainer, preferred date/time, and name.",
  },
  retail: {
    bookingLabel: "ORDER",
    bookingLabelPlural: "ORDERS",
    customerWord: "customer",
    greeting: "Thanks for calling! How can I help you today?",
    bookingPrompt: "Help customers with product availability, special orders, or questions. Ask what they're looking for.",
  },
  professional: {
    bookingLabel: "CONSULTATION",
    bookingLabelPlural: "CONSULTATIONS",
    customerWord: "client",
    greeting: "Thanks for calling! Are you looking to schedule a consultation?",
    bookingPrompt: "Help clients schedule consultations. Ask what service they need, preferred date/time, and name.",
  },
  other: {
    bookingLabel: "BOOKING",
    bookingLabelPlural: "BOOKINGS",
    customerWord: "caller",
    greeting: "Thanks for calling! How can I help you today?",
    bookingPrompt: "Help callers book appointments, answer questions, and take messages.",
  },
};
