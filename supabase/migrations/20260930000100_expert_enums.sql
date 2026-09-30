-- Notification kinds for the taste-expert flow.
--
-- In their own migration because a value added to an enum inside a
-- transaction can't be used until that transaction commits, and the next
-- migration uses these.
alter type public.notification_kind add value if not exists 'expert_approved';
alter type public.notification_kind add value if not exists 'expert_declined';
