import { useState } from 'react';
import { FileText, Download, Loader2, FolderOpen } from 'lucide-react';
import { Button } from '@/components/atoms';
import { EmptyState } from '@/components/molecules';
import { useReports } from '@/hooks/useReports';
import {
  useGenerateReport,
  useGenerateConsolidatedReport,
} from '@/hooks/useReportGeneration';
import { reportsService } from '@/services/reports.service';
import type { Report } from '@/types';

export function Reports() {
  const { data: reports, isLoading } = useReports();
  const generateReport = useGenerateReport();
  const generateConsolidated = useGenerateConsolidatedReport();

  const [inspectionId, setInspectionId] = useState('');
  const [windFarmId, setWindFarmId] = useState('');

  const handleGenerateInspection = () => {
    if (inspectionId.trim()) {
      generateReport.mutate(inspectionId.trim());
      setInspectionId('');
    }
  };

  const handleGenerateConsolidated = () => {
    if (windFarmId.trim()) {
      generateConsolidated.mutate(windFarmId.trim());
      setWindFarmId('');
    }
  };

  const handleDownload = (storagePath: string) => {
    const url = reportsService.getDownloadUrl(storagePath);
    window.open(url, '_blank');
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const pageStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    fontFamily: 'var(--font-family-sans)',
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 'var(--space-4)',
    borderBottom: '1px solid var(--color-neutral-100)',
    flexShrink: 0,
  };

  const headerTitleStyle: React.CSSProperties = {
    margin: 0,
    fontSize: 'var(--text-xl)',
    fontWeight: 600,
    color: 'var(--color-neutral-900)',
  };

  const contentStyle: React.CSSProperties = {
    flex: 1,
    overflow: 'auto',
    padding: 'var(--space-4)',
  };

  const generateSectionStyle: React.CSSProperties = {
    display: 'flex',
    gap: 'var(--space-3)',
    flexWrap: 'wrap',
    marginBottom: 'var(--space-6)',
    padding: 'var(--space-4)',
    background: 'var(--color-neutral-50)',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--color-neutral-100)',
  };

  const inputStyle: React.CSSProperties = {
    padding: 'var(--space-2) var(--space-3)',
    border: '1px solid var(--color-neutral-200)',
    borderRadius: 'var(--radius-sm)',
    fontSize: 'var(--text-sm)',
    minWidth: '200px',
  };

  const tableStyle: React.CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
  };

  const thStyle: React.CSSProperties = {
    textAlign: 'left',
    padding: 'var(--space-3)',
    borderBottom: '2px solid var(--color-neutral-200)',
    fontSize: 'var(--text-sm)',
    fontWeight: 600,
    color: 'var(--color-neutral-600)',
  };

  const tdStyle: React.CSSProperties = {
    padding: 'var(--space-3)',
    borderBottom: '1px solid var(--color-neutral-100)',
    fontSize: 'var(--text-sm)',
    color: 'var(--color-neutral-800)',
  };

  const typeIconStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 'var(--space-2)',
  };

  if (isLoading) {
    return (
      <div style={pageStyle}>
        <div style={headerStyle}>
          <h1 style={headerTitleStyle}>Reports</h1>
        </div>
        <div style={{ ...contentStyle, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} />
          <span style={{ marginLeft: 'var(--space-2)' }}>Loading reports...</span>
        </div>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <div style={headerStyle}>
        <h1 style={headerTitleStyle}>Reports</h1>
      </div>

      <div style={contentStyle}>
        {/* Generate section */}
        <div style={generateSectionStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <input
              type="text"
              placeholder="Inspection ID"
              value={inspectionId}
              onChange={(e) => setInspectionId(e.target.value)}
              style={inputStyle}
              aria-label="Inspection ID for report generation"
            />
            <Button
              variant="primary"
              size="sm"
              onClick={handleGenerateInspection}
              disabled={!inspectionId.trim() || generateReport.isPending}
            >
              {generateReport.isPending ? <Loader2 size={14} /> : <FileText size={14} />}
              {' '}Generate Inspection Report
            </Button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <input
              type="text"
              placeholder="Wind Farm ID"
              value={windFarmId}
              onChange={(e) => setWindFarmId(e.target.value)}
              style={inputStyle}
              aria-label="Wind Farm ID for consolidated report"
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={handleGenerateConsolidated}
              disabled={!windFarmId.trim() || generateConsolidated.isPending}
            >
              {generateConsolidated.isPending ? <Loader2 size={14} /> : <FolderOpen size={14} />}
              {' '}Generate Consolidated Report
            </Button>
          </div>
        </div>

        {/* Reports list */}
        {!reports || reports.length === 0 ? (
          <EmptyState
            title="No reports generated yet"
            description="Generate an inspection or consolidated report using the controls above."
          />
        ) : (
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Type</th>
                <th style={thStyle}>Name</th>
                <th style={thStyle}>Generated</th>
                <th style={thStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((report: Report) => (
                <tr key={report.id}>
                  <td style={tdStyle}>
                    <span style={typeIconStyle}>
                      {report.type === 'inspection' ? (
                        <FileText size={16} color="var(--color-primary-500)" />
                      ) : (
                        <FolderOpen size={16} color="var(--color-secondary-500)" />
                      )}
                      {report.type === 'inspection' ? 'Inspection' : 'Consolidated'}
                    </span>
                  </td>

                  <td style={tdStyle}>{report.filename || 'Untitled Report'}</td>
                  <td style={tdStyle}>{formatDate(report.generated_at)}</td>
                  <td style={tdStyle}>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDownload(report.storage_path)}
                      aria-label={`Download ${report.filename || 'report'}`}
                    >
                      <Download size={14} /> Download
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
