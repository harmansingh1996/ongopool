-- Migration: create process_booking_timeouts RPC
-- Purpose: mark pending bookings whose response_deadline has passed as timeout_cancelled
-- and record the action timestamp for payment/refund automation

begin;

drop function if exists public.process_booking_timeouts();

create function public.process_booking_timeouts()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_now timestamptz := now();
begin
    -- Update pending bookings that have missed their response deadline
    update public.ride_bookings
       set status = 'timeout_cancelled',
           payment_status = coalesce(payment_status, 'authorized'),
           updated_at = v_now
     where status = 'pending'
       and response_deadline is not null
       and response_deadline <= v_now;

    -- Optionally, you could log how many rows were touched for analytics:
    -- PERFORM pg_notify('booking_timeouts', json_build_object('processed', FOUND)::text);
end;
$$;

grant execute on function public.process_booking_timeouts() to authenticated;

grant execute on function public.process_booking_timeouts() to service_role;

grant execute on function public.process_booking_timeouts() to anon;

commit;
