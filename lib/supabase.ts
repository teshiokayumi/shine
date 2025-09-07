import { createBrowserClient, createServerClient } from "@supabase/ssr"

const supabaseUrl = "https://idhxfowbqbazjrabyums.supabase.co"
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlkaHhmb3dicWJhempyYWJ5dW1zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY5MTY1NzUsImV4cCI6MjA3MjQ5MjU3NX0.PwNtRSJz_mVoqlRIBl-s0yqjA93ZmQ5ovcv83ii7C7o"

export function createClient() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}

export function createServerSupabaseClient() {
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return undefined
      },
      set(name: string, value: string, options: any) {
        // Cookie setting logic for server-side
      },
      remove(name: string, options: any) {
        // Cookie removal logic for server-side
      },
    },
  })
}
