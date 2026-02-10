/**
 * Companies Service
 * CRUD and templates for company profiles (branding, A4/PPT)
 */

import { http } from './api';

export interface AnalysisReport {
  ficha_identidade?: string;
  visao_geral?: string;
  produtos_servicos?: string;
  publico_alvo?: string;
  equipa_lideranca?: string;
  presenca_digital?: string;
  analise_competitiva?: string;
  indicadores_crescimento?: string;
  swot?: string;
  conclusoes?: string;
}

export interface BrandAssets {
  primary_color?: string;
  secondary_color?: string;
  ai_context?: string;
  analyzed_at?: string;
  analysis_report?: AnalysisReport;
}

export interface Company {
  id: string;
  name: string;
  description?: string | null;
  logo_url?: string | null;
  website_url?: string | null;
  linkedin_url?: string | null;
  owner_id: string;
  brand_assets?: BrandAssets;
  a4_template_html?: string | null;
  ppt_template_html?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface CreateCompanyRequest {
  name: string;
  description?: string;
  logo_url?: string;
  website_url?: string;
  linkedin_url?: string;
}

export interface UpdateCompanyRequest {
  name?: string;
  description?: string;
  logo_url?: string;
  website_url?: string;
  linkedin_url?: string;
  brand_assets?: BrandAssets;
}

export async function listCompanies(): Promise<Company[]> {
  try {
    const res = await http.get<{ companies?: Company[] }>('/api/companies');
    const list = res.data?.companies;
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export async function getCompany(id: string): Promise<Company | null> {
  try {
    const res = await http.get<{ company: Company }>(`/api/companies/${id}`);
    return res.data?.company ?? null;
  } catch {
    return null;
  }
}

export async function createCompany(data: CreateCompanyRequest): Promise<Company> {
  const res = await http.post<{ company: Company }>('/api/companies', data);
  return res.data.company;
}

export async function updateCompany(id: string, data: UpdateCompanyRequest): Promise<Company> {
  const res = await http.put<{ company: Company }>(`/api/companies/${id}`, data);
  return res.data.company;
}

export async function deleteCompany(id: string): Promise<void> {
  await http.delete(`/api/companies/${id}`);
}

export async function analyzeCompany(id: string): Promise<Company> {
  const res = await http.post<{ company: Company }>(`/api/companies/${id}/analyze`, {});
  return res.data.company;
}

export type TemplateType = 'a4' | 'ppt';

export async function getTemplate(companyId: string, type: TemplateType): Promise<string> {
  const res = await http.get<{ html: string }>(`/api/companies/${companyId}/templates/${type}`);
  return res.data?.html ?? '';
}

export async function updateTemplate(companyId: string, type: TemplateType, html: string): Promise<void> {
  await http.put(`/api/companies/${companyId}/templates/${type}`, { html });
}

export async function generateTemplate(companyId: string, type: TemplateType): Promise<{ html: string; company: Company }> {
  const res = await http.post<{ html: string; company: Company }>(`/api/companies/${companyId}/templates/generate`, { type });
  return { html: res.data.html, company: res.data.company };
}
