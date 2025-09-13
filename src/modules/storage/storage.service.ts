import { Injectable } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

@Injectable()
export class StorageService {
  private client: SupabaseClient;
  private bucket: string;
  private enabled = false;

  constructor() {
    const url = process.env.SUPABASE_URL as string | undefined;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string | undefined;
    this.bucket = process.env.SUPABASE_BUCKET || 'user-attachments';
    if (url && serviceKey) {
      this.client = createClient(url, serviceKey, { auth: { persistSession: false } });
      this.enabled = true;
    }
  }

  buildObjectPath(params: { userId: string; attachmentType: string; filename: string }) {
    const { userId, attachmentType, filename } = params;
    const now = new Date();
    const yyyy = String(now.getFullYear());
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const clean = filename.replace(/[^a-zA-Z0-9_.-]/g, '_');
    return `${userId}/${attachmentType}/${yyyy}/${mm}/${randomUUID()}-${clean}`;
  }

  async createSignedUploadUrl(objectPath: string) {
    if (!this.enabled) throw new Error('Storage not configured. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    const { data, error } = await this.client.storage.from(this.bucket).createSignedUploadUrl(objectPath);
    if (error) throw error;
    return { signedUrl: data.signedUrl, token: data.token };
  }

  async createSignedDownloadUrl(objectPath: string, expiresInSeconds = 600) {
    if (!this.enabled) throw new Error('Storage not configured. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    const { data, error } = await this.client.storage.from(this.bucket).createSignedUrl(objectPath, expiresInSeconds);
    if (error) throw error;
    return { signedUrl: data.signedUrl, expiresIn: expiresInSeconds };
  }
}


