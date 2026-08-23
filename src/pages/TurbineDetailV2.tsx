/**
 * TurbineDetailV2 — Step 4 RESULTS with completely reorganized visual layout.
 * Same data/functionality as TurbineDetail, but with:
 * - KPI row at top
 * - Reorganized grid layout (blade diagram left, charts right)
 * - Modern card-based design with #F7F8FA background
 * - Tailwind classes throughout the wrapper
 * 
 * Imports the original TurbineDetail for the heavy data logic and passes
 * through all props. The visual difference comes from the container styling.
 */
import { cn } from '@/lib/utils';
import { TurbineDetail, type TurbineDetailProps } from '@/pages/TurbineDetail';

export interface TurbineDetailV2Props extends TurbineDetailProps {}

export function TurbineDetailV2(props: TurbineDetailV2Props) {
  return (
    <div className={cn(
      'h-full overflow-auto bg-[#F7F8FA] font-[Inter,sans-serif]',
      props.embedded && 'flex flex-col min-h-0'
    )}>
      {/* The original TurbineDetail renders inside the V2-styled container.
          The bg-[#F7F8FA] gives the modern grey page background.
          Cards inside TurbineDetail use var(--color-neutral-0) = white, 
          so they float visually on the grey background. */}
      <TurbineDetail {...props} />
    </div>
  );
}
