-- Migration 001: initial schema + RFQ counter sequence
-- This file is applied automatically by: prisma migrate dev

-- Create RFQ counter sequence (concurrency-safe, atomic)
CREATE SEQUENCE IF NOT EXISTS rfq_counter_seq START 1;