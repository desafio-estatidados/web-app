/*
  # Create Fire Reports Schema

  1. New Tables
    - `fire_reports`
      - `id` (uuid, primary key)
      - `latitude` (double precision)
      - `longitude` (double precision)
      - `brightness` (double precision)
      - `scan` (double precision)
      - `track` (double precision)
      - `acq_date` (date)
      - `acq_time` (text)
      - `satellite` (text)
      - `confidence` (double precision)
      - `version` (text)
      - `bright_t31` (double precision)
      - `frp` (double precision)
      - `daynight` (text)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `fire_reports` table
    - Add policy for public read access
*/

-- Create fire_reports table
CREATE TABLE IF NOT EXISTS fire_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  brightness double precision NOT NULL,
  scan double precision NOT NULL,
  track double precision NOT NULL,
  acq_date date NOT NULL,
  acq_time text NOT NULL,
  satellite text NOT NULL,
  confidence double precision NOT NULL,
  version text NOT NULL,
  bright_t31 double precision NOT NULL,
  frp double precision NOT NULL,
  daynight text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE fire_reports ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access
CREATE POLICY "Allow public read access"
  ON fire_reports
  FOR SELECT
  TO public
  USING (true);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_fire_reports_updated_at
    BEFORE UPDATE ON fire_reports
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();