import { supabase } from '@/lib/supabase';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;
import type {
  WindFarmDetail,
  TurbineSubassetRow,
  Campaign,
  CampaignInspection,
  AssetDocument,
  TurbineSerialNumbers,
} from '@/types';

// ─── Custom Error ───────────────────────────────────────────────────────────

export class AssetDetailServiceError extends Error {
  constructor(
    message: string,
    public code?: string,
  ) {
    super(message);
    this.name = 'AssetDetailServiceError';
  }
}

// ─── Service ────────────────────────────────────────────────────────────────

export const assetDetailService = {
  // ─── Wind Farm Detail ───────────────────────────────────────────────────

  async getWindFarmDetail(windFarmId: string): Promise<WindFarmDetail> {
    // Client-side aggregation (works without migration)
    const { data: farm, error: farmErr } = await supabase
      .from('wind_farm')
      .select('id, name, location, powering_date')
      .eq('id', windFarmId)
      .single();
    if (farmErr || !farm) throw new AssetDetailServiceError('Wind farm not found', '404');

    const { data: turbines } = await supabase
      .from('turbine')
      .select(`
        id, power_kw,
        blades:blade(inspections:inspection(id, created_at)),
        direct_inspections:inspection!inspection_turbine_id_fkey(id, created_at)
      `)
      .eq('wind_farm_id', windFarmId);

    // Collect inspections from both paths and deduplicate
    const inspMap = new Map<string, Record<string, unknown>>();
    for (const t of (turbines ?? []) as Array<Record<string, unknown>>) {
      const blades = (t.blades as Array<Record<string, unknown>>) ?? [];
      for (const b of blades) {
        for (const insp of ((b.inspections as Array<Record<string, unknown>>) ?? [])) {
          inspMap.set(insp.id as string, insp);
        }
      }
      for (const insp of ((t.direct_inspections as Array<Record<string, unknown>>) ?? [])) {
        inspMap.set(insp.id as string, insp);
      }
    }
    const allInspections = Array.from(inspMap.values());
    const oldest = allInspections.length > 0
      ? allInspections.reduce((min, i) => ((i.created_at as string) < min ? (i.created_at as string) : min), allInspections[0]!.created_at as string)
      : null;

    // Sum power_kw from all turbines
    const totalPower = (turbines ?? []).reduce((sum, t: Record<string, unknown>) => sum + (Number(t.power_kw) || 0), 0);

    return {
      id: farm.id,
      name: farm.name,
      location: (farm as Record<string, unknown>).location as string ?? '',
      poweringDate: (farm as Record<string, unknown>).powering_date as string ?? null,
      totalPower,
      subAssetsCount: (turbines ?? []).length,
      oldestInspection: oldest,
      inspectionsCount: allInspections.length,
    };
  },

  // ─── Subassets (Turbines) ─────────────────────────────────────────────

  async getSubassets(windFarmId: string): Promise<TurbineSubassetRow[]> {
    // Query turbines with inspections via both paths:
    // 1. blade → inspection (blade_id FK)
    // 2. direct turbine_id FK on inspection
    const { data: turbines, error: tErr } = await supabase
      .from('turbine')
      .select(`
        id, name, model, power_kw, powering_date,
        blades:blade(inspections:inspection(id, created_at)),
        direct_inspections:inspection!inspection_turbine_id_fkey(id, created_at)
      `)
      .eq('wind_farm_id', windFarmId)
      .order('name');
    if (tErr) throw new AssetDetailServiceError(tErr.message, tErr.code);

    return ((turbines as unknown[]) ?? []).map((t: unknown) => {
      const r = t as Record<string, unknown>;
      const blades = (r.blades as Array<Record<string, unknown>>) ?? [];
      const bladeInspections = blades.flatMap((b) => (b.inspections as Array<Record<string, unknown>>) ?? []);
      const directInspections = (r.direct_inspections as Array<Record<string, unknown>>) ?? [];

      // Deduplicate by inspection id (some may be linked via both paths)
      const allInspectionsMap = new Map<string, Record<string, unknown>>();
      for (const insp of bladeInspections) allInspectionsMap.set(insp.id as string, insp);
      for (const insp of directInspections) allInspectionsMap.set(insp.id as string, insp);
      const allInspections = Array.from(allInspectionsMap.values());

      const lastInsp = allInspections.length > 0
        ? allInspections.reduce((max, i) => ((i.created_at as string) > max ? (i.created_at as string) : max), allInspections[0]!.created_at as string)
        : null;
      return {
        id: r.id as string,
        name: r.name as string,
        model: (r.model as string) ?? null,
        serialNumber: null,
        powerKw: Number(r.power_kw) || 0,
        poweringDate: (r.powering_date as string) ?? null,
        lastInspection: lastInsp,
        inspectionsCount: allInspections.length,
      };
    });
  },

  // ─── Campaigns ────────────────────────────────────────────────────────

  async getCampaigns(windFarmId: string): Promise<Campaign[]> {
    const { data, error } = await db
      .from('campaign')
      .select('*')
      .eq('wind_farm_id', windFarmId)
      .order('created_at', { ascending: false });
    if (error) throw new AssetDetailServiceError(error.message, error.code);
    return ((data as unknown[]) ?? []).map((r: unknown) => {
      const row = r as Record<string, unknown>;
      return {
        id: row.id as string,
        name: row.name as string,
        windFarmId: row.wind_farm_id as string,
        createdBy: row.created_by as string | null,
        createdAt: row.created_at as string,
        updatedAt: row.updated_at as string,
      };
    });
  },

  async createCampaign(windFarmId: string, name: string): Promise<Campaign> {
    const user = (await db.auth.getUser()).data.user;
    const { data, error } = await db
      .from('campaign')
      .insert({ wind_farm_id: windFarmId, name, created_by: user?.id ?? null })
      .select()
      .single();
    if (error) throw new AssetDetailServiceError(error.message, error.code);
    const r = data as Record<string, unknown>;
    return {
      id: r.id as string,
      name: r.name as string,
      windFarmId: r.wind_farm_id as string,
      createdBy: r.created_by as string | null,
      createdAt: r.created_at as string,
      updatedAt: r.updated_at as string,
    };
  },

  async updateCampaign(campaignId: string, name: string): Promise<void> {
    const { error } = await db
      .from('campaign')
      .update({ name })
      .eq('id', campaignId);
    if (error) throw new AssetDetailServiceError(error.message, error.code);
  },

  async deleteCampaign(campaignId: string): Promise<void> {
    const { error } = await db
      .from('campaign')
      .delete()
      .eq('id', campaignId);
    if (error) throw new AssetDetailServiceError(error.message, error.code);
  },

  async assignInspectionsToCampaign(
    campaignId: string,
    inspectionIds: string[],
  ): Promise<void> {
    const { error } = await db
      .from('inspection')
      .update({ campaign_id: campaignId })
      .in('id', inspectionIds);
    if (error) throw new AssetDetailServiceError(error.message, error.code);
  },

  async unassignInspectionsFromCampaign(inspectionIds: string[]): Promise<void> {
    if (inspectionIds.length === 0) return;
    const { error } = await db
      .from('inspection')
      .update({ campaign_id: null })
      .in('id', inspectionIds);
    if (error) throw new AssetDetailServiceError(error.message, error.code);
  },

  async getCampaignInspections(campaignId: string, windFarmId?: string): Promise<CampaignInspection[]> {
    const { data, error } = await db
      .from('inspection')
      .select(`
        id,
        created_at,
        status,
        stage,
        inspection_type,
        photos_count,
        viewed_percent,
        notes,
        campaign_id,
        turbine_id,
        blade:blade!inspection_blade_id_fkey(
          turbine:turbine!blade_turbine_id_fkey(id, name, wind_farm_id)
        ),
        turbine:turbine!inspection_turbine_id_fkey(id, name, wind_farm_id),
        defects:defect(id)
      `)
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: false });
    if (error) return [];

    let inspections = (data as unknown[]) ?? [];

    // Filter by wind farm if provided
    if (windFarmId) {
      inspections = inspections.filter((row: unknown) => {
        const r = row as Record<string, unknown>;
        const blade = r.blade as Record<string, unknown> | null;
        const bladeTurbine = blade?.turbine as Record<string, unknown> | null;
        const directTurbine = r.turbine as Record<string, unknown> | null;
        const turbineWindFarmId = bladeTurbine?.wind_farm_id ?? directTurbine?.wind_farm_id;
        return turbineWindFarmId === windFarmId;
      });
    }

    // Fetch reports for these inspections
    const inspIds = inspections.map((row: unknown) => (row as Record<string, unknown>).id as string);
    let reportMap: Record<string, string> = {};
    if (inspIds.length > 0) {
      const { data: reports } = await db
        .from('report')
        .select('reference_id, storage_path')
        .in('reference_id', inspIds);
      if (reports) {
        for (const r of reports as Array<{ reference_id: string; storage_path: string }>) {
          if (!reportMap[r.reference_id]) reportMap[r.reference_id] = r.storage_path;
        }
      }
    }

    // Fetch real photo counts from inspection_photo by campaign_id
    const photosCountMap: Record<string, number> = {};
    const { data: photoCounts } = await db
      .from('inspection_photo')
      .select('blade_id')
      .eq('campaign_id', campaignId);
    if (photoCounts && photoCounts.length > 0) {
      // Count photos per blade_id
      const bladePhotoCounts: Record<string, number> = {};
      for (const p of photoCounts as Array<{ blade_id: string | null }>) {
        if (p.blade_id) {
          bladePhotoCounts[p.blade_id] = (bladePhotoCounts[p.blade_id] || 0) + 1;
        }
      }
      // Map blade → turbine
      const bladeIds = Object.keys(bladePhotoCounts);
      if (bladeIds.length > 0) {
        const { data: bladeData } = await db
          .from('blade')
          .select('id, turbine_id')
          .in('id', bladeIds);
        if (bladeData) {
          // turbine_id → total photos
          const turbinePhotos: Record<string, number> = {};
          for (const b of bladeData as Array<{ id: string; turbine_id: string }>) {
            turbinePhotos[b.turbine_id] = (turbinePhotos[b.turbine_id] || 0) + (bladePhotoCounts[b.id] || 0);
          }
          // Map turbine_id → inspection_id
          for (const row of inspections) {
            const r = row as Record<string, unknown>;
            const blade = r.blade as Record<string, unknown> | null;
            const bladeTurbine = blade?.turbine as Record<string, unknown> | null;
            const directTurbine = r.turbine as Record<string, unknown> | null;
            const turbineId = (r.turbine_id as string) ?? (bladeTurbine?.id as string) ?? (directTurbine?.id as string);
            if (turbineId && turbinePhotos[turbineId]) {
              photosCountMap[r.id as string] = turbinePhotos[turbineId];
            }
          }
        }
      }
      // Fallback: if no blade mapping found but photos exist, assign total to all inspections
      if (Object.keys(photosCountMap).length === 0 && inspections.length === 1) {
        const r = inspections[0] as Record<string, unknown>;
        photosCountMap[r.id as string] = photoCounts.length;
      }
    }

    return inspections.map((row: unknown) => {
      const r = row as Record<string, unknown>;
      const blade = r.blade as Record<string, unknown> | null;
      const bladeTurbine = blade?.turbine as Record<string, unknown> | null;
      const directTurbine = r.turbine as Record<string, unknown> | null;
      const turbineName = (bladeTurbine?.name ?? directTurbine?.name) as string | null;
      const defects = (r.defects as unknown[]) ?? [];
      const inspId = r.id as string;
      const realPhotosCount = photosCountMap[inspId] ?? Number(r.photos_count) ?? 0;
      return {
        id: inspId,
        inspectionDate: r.created_at as string,
        subassetName: turbineName ?? 'Unknown',
        status: r.status as string,
        stage: (r.stage as string) ?? 'planned',
        inspectionType: (r.inspection_type as string) ?? 'blades',
        photosCount: realPhotosCount,
        viewedPercent: Number(r.viewed_percent) || 0,
        defectsCount: defects.length,
        notes: r.notes as string | null,
        reportUrl: null,
        reportStoragePath: reportMap[inspId] || null,
        campaignId: r.campaign_id as string | null,
        turbineId: (r.turbine_id as string) ?? (bladeTurbine?.id as string) ?? (directTurbine?.id as string) ?? null,
      } as CampaignInspection;
    });
  },

  // Get all inspections for a wind farm (for campaign assignment modal)
  async getWindFarmInspections(windFarmId: string): Promise<CampaignInspection[]> {
    const { data, error } = await db
      .from('inspection')
      .select(`
        id,
        created_at,
        status,
        stage,
        inspection_type,
        photos_count,
        viewed_percent,
        notes,
        campaign_id,
        turbine_id,
        blade:blade!inspection_blade_id_fkey(
          turbine:turbine!blade_turbine_id_fkey(
            id,
            name,
            wind_farm_id
          )
        ),
        turbine:turbine!inspection_turbine_id_fkey(id, name, wind_farm_id),
        defects:defect(id)
      `)
      .order('created_at', { ascending: false });
    if (error) throw new AssetDetailServiceError(error.message, error.code);

    // Filter client-side by wind_farm_id (via blade → turbine OR direct turbine)
    const filteredInspections = ((data as unknown[]) ?? [])
      .filter((row: unknown) => {
        const r = row as Record<string, unknown>;
        const blade = r.blade as Record<string, unknown> | null;
        const bladeTurbine = blade?.turbine as Record<string, unknown> | null;
        const directTurbine = r.turbine as Record<string, unknown> | null;
        const turbineWindFarmId = bladeTurbine?.wind_farm_id ?? directTurbine?.wind_farm_id;
        return turbineWindFarmId === windFarmId;
      });

    // Fetch real photo counts per campaign_id
    const campaignIds = [...new Set(
      filteredInspections
        .map((row: unknown) => (row as Record<string, unknown>).campaign_id as string | null)
        .filter(Boolean) as string[]
    )];
    const campaignPhotosMap: Record<string, number> = {};
    if (campaignIds.length > 0) {
      const { data: photoRows } = await db
        .from('inspection_photo')
        .select('campaign_id, blade_id')
        .in('campaign_id', campaignIds);
      if (photoRows) {
        // Count photos per blade
        const bladePhotoCounts: Record<string, number> = {};
        for (const p of photoRows as Array<{ campaign_id: string; blade_id: string | null }>) {
          if (p.blade_id) {
            const key = `${p.campaign_id}:${p.blade_id}`;
            bladePhotoCounts[key] = (bladePhotoCounts[key] || 0) + 1;
          }
        }
        // Map blade → turbine
        const allBladeIds = [...new Set(
          (photoRows as Array<{ blade_id: string | null }>)
            .map(p => p.blade_id)
            .filter(Boolean) as string[]
        )];
        if (allBladeIds.length > 0) {
          const { data: bladeData } = await db
            .from('blade')
            .select('id, turbine_id')
            .in('id', allBladeIds);
          if (bladeData) {
            const bladeTurbineMap: Record<string, string> = {};
            for (const b of bladeData as Array<{ id: string; turbine_id: string }>) {
              bladeTurbineMap[b.id] = b.turbine_id;
            }
            // Build turbine → photos count per campaign
            const turbineCampaignPhotos: Record<string, number> = {};
            for (const [key, count] of Object.entries(bladePhotoCounts)) {
              const [cId, bladeId] = key.split(':');
              const turbineId = bladeTurbineMap[bladeId!];
              if (turbineId) {
                const tKey = `${cId}:${turbineId}`;
                turbineCampaignPhotos[tKey] = (turbineCampaignPhotos[tKey] || 0) + count;
              }
            }
            // Map to inspections
            for (const row of filteredInspections) {
              const r = row as Record<string, unknown>;
              const cId = r.campaign_id as string | null;
              const blade = r.blade as Record<string, unknown> | null;
              const bladeTurbine = blade?.turbine as Record<string, unknown> | null;
              const directTurbine = r.turbine as Record<string, unknown> | null;
              const turbineId = (r.turbine_id as string) ?? (bladeTurbine?.id as string) ?? (directTurbine?.id as string);
              if (cId && turbineId) {
                const tKey = `${cId}:${turbineId}`;
                if (turbineCampaignPhotos[tKey]) {
                  campaignPhotosMap[r.id as string] = turbineCampaignPhotos[tKey];
                }
              }
            }
          }
        }
        // Fallback: count per campaign if no blade mapping
        if (Object.keys(campaignPhotosMap).length === 0) {
          const perCampaign: Record<string, number> = {};
          for (const p of photoRows as Array<{ campaign_id: string }>) {
            perCampaign[p.campaign_id] = (perCampaign[p.campaign_id] || 0) + 1;
          }
          for (const row of filteredInspections) {
            const r = row as Record<string, unknown>;
            const cId = r.campaign_id as string | null;
            if (cId && perCampaign[cId]) {
              campaignPhotosMap[r.id as string] = perCampaign[cId];
            }
          }
        }
      }
    }

    return filteredInspections.map((row: unknown) => {
        const r = row as Record<string, unknown>;
        const blade = r.blade as Record<string, unknown> | null;
        const bladeTurbine = blade?.turbine as Record<string, unknown> | null;
        const directTurbine = r.turbine as Record<string, unknown> | null;
        const turbineName = (bladeTurbine?.name ?? directTurbine?.name) as string | null;
        const defects = (r.defects as unknown[]) ?? [];
        const inspId = r.id as string;
        const realPhotosCount = campaignPhotosMap[inspId] ?? Number(r.photos_count) ?? 0;
        return {
          id: inspId,
          inspectionDate: r.created_at as string,
          subassetName: turbineName ?? 'Unknown',
          status: r.status as string,
          stage: (r.stage as string) ?? 'planned',
          inspectionType: (r.inspection_type as string) ?? 'blades',
          photosCount: realPhotosCount,
          viewedPercent: Number(r.viewed_percent) || 0,
          defectsCount: defects.length,
          notes: r.notes as string | null,
          reportUrl: null,
        reportStoragePath: null,
          campaignId: r.campaign_id as string | null,
          turbineId: (r.turbine_id as string) ?? (bladeTurbine?.id as string) ?? (directTurbine?.id as string) ?? null,
        } as CampaignInspection;
      });
  },

  // ─── Serial Numbers ───────────────────────────────────────────────────

  async getSerialNumbers(windFarmId: string): Promise<TurbineSerialNumbers[]> {
    const { data, error } = await supabase
      .from('turbine')
      .select('id, name, serial_number, tower_serial_number, anticlockwise, blades:blade(position, serial_number)')
      .eq('wind_farm_id', windFarmId)
      .order('name');
    if (error) throw new AssetDetailServiceError(error.message, error.code);

    return ((data as unknown[]) ?? []).map((row: unknown) => {
      const r = row as Record<string, unknown>;
      const blades = (r.blades as Array<{ position: number; serial_number: string | null }>) ?? [];
      const bladeA = blades.find((b) => b.position === 1);
      const bladeB = blades.find((b) => b.position === 2);
      const bladeC = blades.find((b) => b.position === 3);
      return {
        turbineId: r.id as string,
        turbineName: r.name as string,
        turbineSerial: (r.serial_number as string) ?? '',
        bladeASerial: bladeA?.serial_number ?? '',
        bladeBSerial: bladeB?.serial_number ?? '',
        bladeCSerial: bladeC?.serial_number ?? '',
        towerSerial: (r.tower_serial_number as string) ?? '',
        anticlockwise: (r.anticlockwise as boolean) ?? false,
      };
    });
  },

  async updateSerialNumbers(
    serials: TurbineSerialNumbers[],
  ): Promise<void> {
    // Update turbine serial numbers
    for (const s of serials) {
      const { error: turbineError } = await db
        .from('turbine')
        .update({
          serial_number: s.turbineSerial || null,
          tower_serial_number: s.towerSerial || null,
          anticlockwise: s.anticlockwise,
        })
        .eq('id', s.turbineId);
      if (turbineError) throw new AssetDetailServiceError(turbineError.message, turbineError.code);

      // Update blade serial numbers
      const { data: blades } = await db
        .from('blade')
        .select('id, position')
        .eq('turbine_id', s.turbineId)
        .order('position');

      if (blades) {
        for (const blade of blades as Array<{ id: string; position: number }>) {
          let serial = '';
          if (blade.position === 1) serial = s.bladeASerial;
          if (blade.position === 2) serial = s.bladeBSerial;
          if (blade.position === 3) serial = s.bladeCSerial;
          const { error: bladeError } = await db
            .from('blade')
            .update({ serial_number: serial || null })
            .eq('id', blade.id);
          if (bladeError) throw new AssetDetailServiceError(bladeError.message, bladeError.code);
        }
      }
    }
  },

  // ─── Documents ────────────────────────────────────────────────────────

  async getDocuments(windFarmId: string): Promise<AssetDocument[]> {
    const { data, error } = await db
      .from('asset_document')
      .select('*')
      .eq('wind_farm_id', windFarmId)
      .order('created_at', { ascending: false });
    if (error) throw new AssetDetailServiceError(error.message, error.code);
    return ((data as unknown[]) ?? []).map((r: unknown) => {
      const row = r as Record<string, unknown>;
      return {
        id: row.id as string,
        windFarmId: row.wind_farm_id as string,
        fileName: row.file_name as string,
        filePath: row.file_path as string,
        fileSize: Number(row.file_size) || 0,
        mimeType: row.mime_type as string | null,
        uploadedBy: row.uploaded_by as string | null,
        createdAt: row.created_at as string,
      };
    });
  },

  async uploadDocument(
    windFarmId: string,
    file: File,
  ): Promise<AssetDocument> {
    const user = (await db.auth.getUser()).data.user;
    const filePath = `${windFarmId}/${Date.now()}-${file.name}`;

    // Upload to storage
    const { error: uploadError } = await db.storage
      .from('asset-documents')
      .upload(filePath, file);
    if (uploadError) throw new AssetDetailServiceError(uploadError.message);

    // Create record
    const { data, error } = await db
      .from('asset_document')
      .insert({
        wind_farm_id: windFarmId,
        file_name: file.name,
        file_path: filePath,
        file_size: file.size,
        mime_type: file.type || null,
        uploaded_by: user?.id ?? null,
      })
      .select()
      .single();
    if (error) throw new AssetDetailServiceError(error.message, error.code);
    const r = data as Record<string, unknown>;
    return {
      id: r.id as string,
      windFarmId: r.wind_farm_id as string,
      fileName: r.file_name as string,
      filePath: r.file_path as string,
      fileSize: Number(r.file_size) || 0,
      mimeType: r.mime_type as string | null,
      uploadedBy: r.uploaded_by as string | null,
      createdAt: r.created_at as string,
    };
  },

  async deleteDocument(documentId: string, filePath: string): Promise<void> {
    // Delete from storage
    const { error: storageError } = await db.storage
      .from('asset-documents')
      .remove([filePath]);
    if (storageError) throw new AssetDetailServiceError(storageError.message);

    // Delete record
    const { error } = await db
      .from('asset_document')
      .delete()
      .eq('id', documentId);
    if (error) throw new AssetDetailServiceError(error.message, error.code);
  },

  async getDocumentUrl(filePath: string): Promise<string> {
    const { data } = await db.storage
      .from('asset-documents')
      .createSignedUrl(filePath, 3600); // 1 hour
    return data?.signedUrl ?? '';
  },

  // ─── Turbine Markers (Map) ────────────────────────────────────────────────

  async getTurbineMarkers(windFarmId: string): Promise<{ id: string; name: string; lat: number; lon: number }[]> {
    const { data, error } = await db
      .from('turbine')
      .select('id, name, latitude, longitude')
      .eq('wind_farm_id', windFarmId)
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)
      .order('name');
    if (error) throw new AssetDetailServiceError(error.message, error.code);
    return ((data as unknown[]) ?? []).map((r: unknown) => {
      const row = r as Record<string, unknown>;
      return {
        id: row.id as string,
        name: row.name as string,
        lat: Number(row.latitude),
        lon: Number(row.longitude),
      };
    });
  },

  // ─── Turbine (Subasset) Detail ──────────────────────────────────────────

  async getTurbineDetail(turbineId: string): Promise<{
    id: string;
    name: string;
    model: string | null;
    serialNumber: string | null;
    powerKw: number;
    poweringDate: string | null;
    latestInspection: string | null;
    inspectionsCount: number;
    windFarmId: string;
    windFarmName: string;
  }> {
    const { data: turbine, error } = await supabase
      .from('turbine')
      .select(`
        id, name, model, power_kw, powering_date,
        wind_farm:wind_farm!turbine_wind_farm_id_fkey(id, name),
        blades:blade(inspections:inspection(id, created_at)),
        direct_inspections:inspection!inspection_turbine_id_fkey(id, created_at)
      `)
      .eq('id', turbineId)
      .single();
    if (error || !turbine) throw new AssetDetailServiceError('Turbine not found', '404');

    const t = turbine as Record<string, unknown>;
    const windFarm = t.wind_farm as Record<string, unknown> | null;
    const blades = (t.blades as Array<Record<string, unknown>>) ?? [];
    const bladeInspections = blades.flatMap((b) => (b.inspections as Array<Record<string, unknown>>) ?? []);
    const directInspections = (t.direct_inspections as Array<Record<string, unknown>>) ?? [];

    // Deduplicate
    const inspMap = new Map<string, Record<string, unknown>>();
    for (const insp of bladeInspections) inspMap.set(insp.id as string, insp);
    for (const insp of directInspections) inspMap.set(insp.id as string, insp);
    const inspections = Array.from(inspMap.values());

    const latest = inspections.length > 0
      ? inspections.reduce((max, i) => ((i.created_at as string) > max ? (i.created_at as string) : max), inspections[0]!.created_at as string)
      : null;

    return {
      id: t.id as string,
      name: t.name as string,
      model: (t.model as string) ?? null,
      serialNumber: null,
      powerKw: Number(t.power_kw) || 0,
      poweringDate: (t.powering_date as string) ?? null,
      latestInspection: latest,
      inspectionsCount: inspections.length,
      windFarmId: (windFarm?.id as string) ?? '',
      windFarmName: (windFarm?.name as string) ?? '',
    };
  },

  async getTurbineInspections(turbineId: string): Promise<CampaignInspection[]> {
    const { data, error } = await db
      .from('inspection')
      .select(`
        id,
        created_at,
        status,
        stage,
        photos_count,
        viewed_percent,
        notes,
        campaign_id,
        turbine_id,
        blade:blade!inspection_blade_id_fkey(
          id,
          turbine:turbine!blade_turbine_id_fkey(id, name)
        ),
        turbine:turbine!inspection_turbine_id_fkey(id, name),
        defects:defect(id)
      `)
      .order('created_at', { ascending: false });
    if (error) throw new AssetDetailServiceError(error.message, error.code);

    // Filter client-side by turbine_id (via blade → turbine OR direct turbine_id)
    return ((data as unknown[]) ?? [])
      .filter((row: unknown) => {
        const r = row as Record<string, unknown>;
        const blade = r.blade as Record<string, unknown> | null;
        const bladeTurbine = blade?.turbine as Record<string, unknown> | null;
        const directTurbine = r.turbine as Record<string, unknown> | null;
        return bladeTurbine?.id === turbineId || directTurbine?.id === turbineId;
      })
      .map((row: unknown) => {
        const r = row as Record<string, unknown>;
        const blade = r.blade as Record<string, unknown> | null;
        const bladeTurbine = blade?.turbine as Record<string, unknown> | null;
        const directTurbine = r.turbine as Record<string, unknown> | null;
        const turbineName = (bladeTurbine?.name ?? directTurbine?.name) as string | null;
        const defects = (r.defects as unknown[]) ?? [];
        // Map stage to display label
        const stage = r.stage as string | null;
        return {
          id: r.id as string,
          inspectionDate: r.created_at as string,
          subassetName: turbineName ?? 'Unknown',
          status: r.status as string,
          stage: stage ?? 'planned',
          inspectionType: (r.inspection_type as string) ?? 'blades',
          photosCount: Number(r.photos_count) || 0,
          viewedPercent: Number(r.viewed_percent) || 0,
          defectsCount: defects.length,
          notes: r.notes as string | null,
          reportUrl: null,
        reportStoragePath: null,
          campaignId: r.campaign_id as string | null,
        } as CampaignInspection;
      });
  },
};
