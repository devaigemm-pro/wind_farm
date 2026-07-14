-- Auto-create 3 blades when a turbine is inserted
create or replace function public.create_blades_for_turbine()
returns trigger as $$
begin
  insert into public.blade (turbine_id, position)
  values (NEW.id, 1), (NEW.id, 2), (NEW.id, 3);
  return NEW;
end;
$$ language plpgsql security definer;

create trigger on_turbine_created
  after insert on public.turbine
  for each row execute function public.create_blades_for_turbine();

-- Auto-create profile when a user signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, name, role)
  values (
    NEW.id,
    NEW.email,
    coalesce(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    coalesce(NEW.raw_user_meta_data->>'role', 'inspector')
  );
  return NEW;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Update updated_at on modification
create or replace function public.set_updated_at()
returns trigger as $$
begin
  NEW.updated_at = now();
  return NEW;
end;
$$ language plpgsql;

-- Apply updated_at trigger to relevant tables
create trigger set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.wind_farm for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.turbine for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.blade for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.inspection for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.defect for each row execute function public.set_updated_at();

-- Helper function to get current user's role (for RLS policies)
create or replace function public.get_user_role()
returns text as $$
  select role from public.profiles where id = auth.uid();
$$ language sql security definer stable;
