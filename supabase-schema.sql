-- Run this in your Supabase SQL editor

-- Add business_type column to businesses table
alter table businesses add column if not exists business_type text;

-- Bookings table
create table if not exists bookings (
  id uuid default gen_random_uuid() primary key,
  business_id uuid references businesses(id),
  customer_name text not null,
  customer_phone text,
  service text,
  date text not null,
  time text not null,
  status text default 'confirmed' check (status in ('confirmed', 'cancelled', 'rescheduled')),
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Inquiries table
create table if not exists inquiries (
  id uuid default gen_random_uuid() primary key,
  business_id uuid references businesses(id),
  customer_name text,
  customer_phone text,
  question text not null,
  notes text,
  created_at timestamptz default now()
);

-- Indexes
create index if not exists idx_bookings_business_id on bookings(business_id);
create index if not exists idx_bookings_customer_phone on bookings(customer_phone);
create index if not exists idx_inquiries_business_id on inquiries(business_id);

-- Enable Realtime
alter publication supabase_realtime add table calls;
alter publication supabase_realtime add table bookings;
alter publication supabase_realtime add table inquiries;
