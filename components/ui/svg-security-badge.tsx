"use client";

import { AlertTriangle, Shield, ShieldAlert, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface SvgSecurityInfo {
  safe: boolean;
  securityLevel: string;
  threatsFound: number;
  blockingThreats: number;
  nonBlockingThreats: number;
  threats: Array<{
    type: string;
    severity: number;
    description: string;
    blocking: boolean;
  }>;
}

interface SvgSecurityBadgeProps {
  securityInfo?: SvgSecurityInfo;
  className?: string;
  showDetails?: boolean;
}

export function SvgSecurityBadge({
  securityInfo,
  className,
  showDetails = false,
}: SvgSecurityBadgeProps) {
  if (!securityInfo) {
    return null;
  }

  const { safe, threatsFound, blockingThreats, nonBlockingThreats, threats } = securityInfo;

  // Determine badge appearance based on security status
  const getBadgeProps = () => {
    if (safe && threatsFound === 0) {
      return {
        variant: "default" as const,
        icon: ShieldCheck,
        text: "Secure",
        className:
          "bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900 dark:text-green-300",
      };
    } else if (safe && nonBlockingThreats > 0) {
      return {
        variant: "secondary" as const,
        icon: Shield,
        text: `${threatsFound} Warning${threatsFound !== 1 ? "s" : ""}`,
        className:
          "bg-yellow-100 text-yellow-800 hover:bg-yellow-200 dark:bg-yellow-900 dark:text-yellow-300",
      };
    } else {
      return {
        variant: "destructive" as const,
        icon: ShieldAlert,
        text: `${blockingThreats} Threat${blockingThreats !== 1 ? "s" : ""}`,
        className: "bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-900 dark:text-red-300",
      };
    }
  };

  const { icon: Icon, text, className: badgeClassName } = getBadgeProps();

  const tooltipContent = (
    <div className="max-w-sm space-y-2">
      <div className="font-semibold">SVG Security Scan Results</div>
      <div className="text-xs space-y-1">
        <div>Status: {safe ? "✅ Safe" : "❌ Unsafe"}</div>
        <div>Threats Found: {threatsFound}</div>
        {blockingThreats > 0 && (
          <div className="text-red-300">Blocking Threats: {blockingThreats}</div>
        )}
        {nonBlockingThreats > 0 && (
          <div className="text-yellow-300">Warnings: {nonBlockingThreats}</div>
        )}
      </div>

      {showDetails && threats.length > 0 && (
        <div className="border-t border-gray-600 pt-2 mt-2">
          <div className="font-medium text-xs mb-1">Threat Details:</div>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {threats.slice(0, 5).map((threat, index) => (
              <div key={index} className="text-xs">
                <div
                  className={cn(
                    "font-medium",
                    threat.blocking ? "text-red-300" : "text-yellow-300"
                  )}
                >
                  {threat.blocking ? "🚨" : "⚠️"} {threat.description}
                </div>
                <div className="text-gray-400 text-[10px]">
                  Severity: {threat.severity}/10 | Type: {threat.type}
                </div>
              </div>
            ))}
            {threats.length > 5 && (
              <div className="text-xs text-gray-400 italic">... and {threats.length - 5} more</div>
            )}
          </div>
        </div>
      )}
    </div>
  );

  const badge = (
    <Badge
      variant="outline"
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium transition-colors",
        badgeClassName,
        className
      )}
    >
      <Icon className="h-3 w-3" />
      {text}
    </Badge>
  );

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent side="top" className="max-w-sm">
          {tooltipContent}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface SvgSecurityWarningProps {
  securityInfo: SvgSecurityInfo;
  fileName: string;
  className?: string;
}

export function SvgSecurityWarning({ securityInfo, fileName, className }: SvgSecurityWarningProps) {
  const { safe, threatsFound, blockingThreats, threats } = securityInfo;

  if (safe && threatsFound === 0) {
    return null;
  }

  const highSeverityThreats = threats.filter((t) => t.severity >= 7);
  const blockingThreatsData = threats.filter((t) => t.blocking);

  return (
    <div
      className={cn(
        "rounded-lg border p-3 space-y-2",
        !safe
          ? "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/50"
          : "border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950/50",
        className
      )}
    >
      <div className="flex items-start gap-2">
        {!safe ? (
          <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
        ) : (
          <Shield className="h-4 w-4 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
        )}
        <div className="flex-1 space-y-1">
          <p
            className={cn(
              "text-sm font-medium",
              !safe ? "text-red-800 dark:text-red-200" : "text-yellow-800 dark:text-yellow-200"
            )}
          >
            {!safe
              ? `Security threats detected in ${fileName}`
              : `Security warnings for ${fileName}`}
          </p>

          <div className="text-xs space-y-1">
            {!safe && blockingThreatsData.length > 0 && (
              <div className="text-red-700 dark:text-red-300">
                <span className="font-medium">
                  {blockingThreatsData.length} blocking threat
                  {blockingThreatsData.length !== 1 ? "s" : ""}
                </span>
                {blockingThreatsData.length <= 3 && (
                  <span className="ml-1">
                    ({blockingThreatsData.map((t) => t.type).join(", ")})
                  </span>
                )}
              </div>
            )}

            {safe && threatsFound > 0 && (
              <div className="text-yellow-700 dark:text-yellow-300">
                <span className="font-medium">
                  {threatsFound} warning{threatsFound !== 1 ? "s" : ""}
                </span>
                {threatsFound <= 3 && (
                  <span className="ml-1">({threats.map((t) => t.type).join(", ")})</span>
                )}
              </div>
            )}
          </div>

          {highSeverityThreats.length > 0 && (
            <div className="mt-2 space-y-1">
              <div className="text-xs font-medium text-gray-600 dark:text-gray-400">
                High severity issues:
              </div>
              {highSeverityThreats.slice(0, 2).map((threat, index) => (
                <div key={index} className="text-xs text-gray-700 dark:text-gray-300 ml-2">
                  • {threat.description} (Severity: {threat.severity}/10)
                </div>
              ))}
              {highSeverityThreats.length > 2 && (
                <div className="text-xs text-gray-500 dark:text-gray-400 ml-2 italic">
                  ... and {highSeverityThreats.length - 2} more
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
