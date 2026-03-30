import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { demoClients } from '@/lib/demo-data'
import { slugify, generateShareToken } from '@/lib/format'
import { getAuthHeaders, getToken } from '@/hooks/useAuth'
import type { Client } from '@/types'

const isDemoMode = () => !getToken()

export const useClients = () => {
  return useQuery({
    queryKey: ['clients'],
    queryFn: async (): Promise<Client[]> => {
      if (isDemoMode()) return demoClients

      const res = await fetch('/api/clients', { headers: getAuthHeaders() })
      if (!res.ok) throw new Error('Failed to fetch clients')
      return res.json()
    },
  })
}

export const useClient = (slug: string) => {
  return useQuery({
    queryKey: ['clients', slug],
    queryFn: async (): Promise<Client | null> => {
      if (isDemoMode()) return demoClients.find((c) => c.slug === slug) ?? null

      const res = await fetch(`/api/clients/${slug}`, { headers: getAuthHeaders() })
      if (res.status === 404) return null
      if (!res.ok) throw new Error('Failed to fetch client')
      return res.json()
    },
    enabled: !!slug,
  })
}

export const useClientByShareToken = (token: string) => {
  return useQuery({
    queryKey: ['clients', 'share', token],
    queryFn: async (): Promise<Client | null> => {
      if (isDemoMode()) return demoClients.find((c) => c.share_token === token) ?? null

      const res = await fetch(`/api/share/${token}`)
      if (res.status === 404) return null
      if (!res.ok) throw new Error('Failed to fetch shared client')
      const data = await res.json()
      return data.client
    },
    enabled: !!token,
  })
}

export const useCreateClient = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: { name: string; notes?: string }) => {
      if (isDemoMode()) {
        const newClient: Client = {
          id: crypto.randomUUID(),
          name: input.name,
          slug: slugify(input.name),
          share_token: generateShareToken(),
          is_active: true,
          created_at: new Date().toISOString(),
          notes: input.notes ?? null,
          meta_ad_account_id: null,
          google_customer_id: null,
        }
        demoClients.push(newClient)
        return newClient
      }

      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          name: input.name,
          slug: slugify(input.name),
          share_token: generateShareToken(),
          notes: input.notes ?? null,
        }),
      })

      if (!res.ok) throw new Error('Failed to create client')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
    },
  })
}

export const useUpdateClient = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: { id: string; slug: string; name?: string; notes?: string; is_active?: boolean }) => {
      if (isDemoMode()) {
        const client = demoClients.find((c) => c.id === input.id)
        if (client) Object.assign(client, input)
        return client
      }

      const res = await fetch(`/api/clients/${input.slug}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(input),
      })

      if (!res.ok) throw new Error('Failed to update client')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
    },
  })
}

export const useDeleteClient = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (slug: string) => {
      if (isDemoMode()) {
        const idx = demoClients.findIndex((c) => c.slug === slug)
        if (idx !== -1) demoClients.splice(idx, 1)
        return
      }

      const res = await fetch(`/api/clients/${slug}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      })

      if (!res.ok) throw new Error('Failed to delete client')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
    },
  })
}
