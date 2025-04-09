export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      fire_reports: {
        Row: {
          id: string
          latitude: number
          longitude: number
          brightness: number
          scan: number
          track: number
          acq_date: string
          acq_time: string
          satellite: string
          confidence: number
          version: string
          bright_t31: number
          frp: number
          daynight: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          latitude: number
          longitude: number
          brightness: number
          scan: number
          track: number
          acq_date: string
          acq_time: string
          satellite: string
          confidence: number
          version: string
          bright_t31: number
          frp: number
          daynight: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          latitude?: number
          longitude?: number
          brightness?: number
          scan?: number
          track?: number
          acq_date?: string
          acq_time?: string
          satellite?: string
          confidence?: number
          version?: string
          bright_t31?: number
          frp?: number
          daynight?: string
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}