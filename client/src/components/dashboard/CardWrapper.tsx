interface CardWrapperProps {
  children: React.ReactNode;
  className?: string;
}

export function CardWrapper({ children, className = "" }: CardWrapperProps) {
  return (
    <div className={`modern-card p-3 sm:p-4 lg:p-6 hover-lift ${className}`}>
      {children}
    </div>
  );
}