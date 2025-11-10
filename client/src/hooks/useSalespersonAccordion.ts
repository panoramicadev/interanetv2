import { useState, useEffect } from 'react';

export interface AccordionState {
  expandedClient: string | null;
  expandedProduct: string | null;
  searchTerm: string;
  debouncedSearchTerm: string;
  productSearchTerm: string;
  debouncedProductSearchTerm: string;
  isSearchExpanded: boolean;
  isProductSearchExpanded: boolean;
  limit: number;
  productLimit: number;
}

export interface AccordionControls extends AccordionState {
  setSearchTerm: (value: string) => void;
  setProductSearchTerm: (value: string) => void;
  setIsSearchExpanded: (value: boolean) => void;
  setIsProductSearchExpanded: (value: boolean) => void;
  setExpandedClient: (value: string | null) => void;
  setExpandedProduct: (value: string | null) => void;
  handleClientClick: (clientName: string) => void;
  handleProductClick: (productName: string) => void;
  handleLoadMore: () => void;
  handleLoadMoreProducts: () => void;
  handleClearSearch: () => void;
  handleClearProductSearch: () => void;
}

export function useSalespersonAccordion(): AccordionControls {
  const [expandedClient, setExpandedClient] = useState<string | null>(null);
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [productSearchTerm, setProductSearchTerm] = useState("");
  const [debouncedProductSearchTerm, setDebouncedProductSearchTerm] = useState("");
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [isProductSearchExpanded, setIsProductSearchExpanded] = useState(false);
  const [limit, setLimit] = useState(10);
  const [productLimit, setProductLimit] = useState(10);

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Debounce product search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedProductSearchTerm(productSearchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [productSearchTerm]);

  const handleClientClick = (clientName: string) => {
    if (expandedClient === clientName) {
      setExpandedClient(null);
    } else {
      setExpandedClient(clientName);
      setExpandedProduct(null); // Close product accordion when opening client
    }
  };

  const handleProductClick = (productName: string) => {
    if (expandedProduct === productName) {
      setExpandedProduct(null);
    } else {
      setExpandedProduct(productName);
      setExpandedClient(null); // Close client accordion when opening product
    }
  };

  const handleLoadMore = () => {
    setLimit(prev => prev + 10);
  };

  const handleLoadMoreProducts = () => {
    setProductLimit(prev => prev + 10);
  };

  const handleClearSearch = () => {
    setSearchTerm("");
    setDebouncedSearchTerm("");
    setIsSearchExpanded(false);
  };

  const handleClearProductSearch = () => {
    setProductSearchTerm("");
    setDebouncedProductSearchTerm("");
    setIsProductSearchExpanded(false);
  };

  return {
    expandedClient,
    expandedProduct,
    searchTerm,
    debouncedSearchTerm,
    productSearchTerm,
    debouncedProductSearchTerm,
    isSearchExpanded,
    isProductSearchExpanded,
    limit,
    productLimit,
    setSearchTerm,
    setProductSearchTerm,
    setIsSearchExpanded,
    setIsProductSearchExpanded,
    setExpandedClient,
    setExpandedProduct,
    handleClientClick,
    handleProductClick,
    handleLoadMore,
    handleLoadMoreProducts,
    handleClearSearch,
    handleClearProductSearch,
  };
}
