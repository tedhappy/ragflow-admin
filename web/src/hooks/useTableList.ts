//
// Copyright 2024 RAGFlow Admin Authors.
//
// Licensed under the Apache License, Version 2.0
//

import { useState, useEffect, useCallback, useRef } from 'react';
import { message } from 'antd';

export interface ListParams {
  page: number;
  page_size: number;
  [key: string]: any;
}

export interface ListResponse<T> {
  items: T[];
  total: number;
}

export interface UseTableListOptions<T, P extends ListParams> {
  fetchFn: (params: P) => Promise<ListResponse<T>>;
  defaultParams?: Partial<P>;
  defaultPageSize?: number;
  enabled?: boolean; // If false, skip initial fetch
}

export interface UseTableListReturn<T, P extends ListParams> {
  data: T[];
  total: number;
  loading: boolean;
  initialLoading: boolean;
  page: number;
  pageSize: number;
  params: P;
  selectedRowKeys: React.Key[];
  setSelectedRowKeys: (keys: React.Key[]) => void;
  setParams: (params: Partial<P>) => void;
  refresh: () => void;
  handlePageChange: (page: number, pageSize: number) => void;
  handleSearch: (searchParams?: Partial<P>) => void;
}

/**
 * Common hook for table list with pagination, search, and selection.
 */
export function useTableList<T, P extends ListParams = ListParams>(
  options: UseTableListOptions<T, P>
): UseTableListReturn<T, P> {
  const { fetchFn, defaultParams = {}, defaultPageSize = 10, enabled = true } = options;

  // Use ref to store fetchFn to avoid infinite loop
  const fetchFnRef = useRef(fetchFn);
  fetchFnRef.current = fetchFn;

  const [data, setData] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [params, setParamsState] = useState<P>({
    page: 1,
    page_size: defaultPageSize,
    ...defaultParams,
  } as P);

  const fetchData = useCallback(async (fetchParams: P, isInitial = false) => {
    try {
      setLoading(true);
      const result = await fetchFnRef.current(fetchParams);
      setData(result.items || []);
      setTotal(result.total || 0);
      if (isInitial) {
        setInitialLoading(false);
      }
    } catch (error: any) {
      message.error(error.message || 'Failed to fetch data');
      setData([]);
      setTotal(0);
      if (isInitial) {
        setInitialLoading(false);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch on mount only (if enabled)
  useEffect(() => {
    if (!enabled) {
      return;
    }
    // Reset initial loading state when enabled
    setInitialLoading(true);
    const initialParams = {
      page: 1,
      page_size: defaultPageSize,
      ...defaultParams,
    } as P;
    fetchData(initialParams, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  const setParams = useCallback((newParams: Partial<P>) => {
    setParamsState(prev => ({ ...prev, ...newParams }));
  }, []);

  const refresh = useCallback(() => {
    fetchData(params);
  }, [fetchData, params]);

  const handlePageChange = useCallback((newPage: number, newPageSize: number) => {
    setPage(newPage);
    setPageSize(newPageSize);
    const newParams = { ...params, page: newPage, page_size: newPageSize };
    setParamsState(newParams);
    fetchData(newParams);
  }, [params, fetchData]);

  const handleSearch = useCallback((searchParams?: Partial<P>) => {
    setPage(1);
    // Merge current params with new search params, reset to page 1
    const newParams = { ...params, ...searchParams, page: 1 } as P;
    setParamsState(newParams);
    fetchData(newParams);
  }, [params, fetchData]);

  return {
    data,
    total,
    loading,
    initialLoading,
    page,
    pageSize,
    params,
    selectedRowKeys,
    setSelectedRowKeys,
    setParams,
    refresh,
    handlePageChange,
    handleSearch,
  };
}

export default useTableList;
