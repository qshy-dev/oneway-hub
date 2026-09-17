import type { SVGProps } from 'react';

type OneWayLogoProps = SVGProps<SVGSVGElement>;

export function OneWayLogo({ className = '', ...props }: OneWayLogoProps) {
  return (
    <svg
      {...props}
      className={`oneway-logo ${className}`}
      viewBox="0 0 512 512"
      fill="none"
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect className="oneway-logo__bar" x="142" y="112" width="64" height="288" />
      <path className="oneway-logo__chevron" d="M248 112h74l116 144-116 144h-74l116-144z" />
    </svg>
  );
}
