//
// Copyright 2024 RAGFlow Admin Authors.
//
// Licensed under the Apache License, Version 2.0
//

import { useState, useEffect, useCallback } from 'react';
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
}

export interface UseTableListReturn<T, P extends ListParams> {
  data: T[];
  total: number;
  loading: boolean;
  page: number;
  pageSize: number;
  params: P;
  selectedRowKeys: React.Key[];
  setSelectedRowKeys: (keys: React.Key[]) => void;
  setParams: (params: Partial<P>) => void;
  refresh: () => void;
  handlePageChange: (page: number, pageSize: number) => void;
  handleSearch: () => void;
}

/**
 * Common hook for table list with pagination, search, and selection.
 */
export function useTableList<T, P extends ListParams = ListParams>(
  options: UseTableListOptions<T, P>
): UseTableListReturn<T, P> {
  const { fetchFn, defaultParams = {}, defaultPageSize = 10 } = options;

  const [data, setData] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [params, setParamsState] = useState<P>({
    page: 1,
    page_size: defaultPageSize,
    ...defaultParams,
  } as P);

  const fetchData = useCallback(async (fetchParams: P) => {
    try {
      setLoading(true);
      const result = await fetchFn(fetchParams);
      setData(result.items || []);
      setTotal(result.total || 0);
    } catch (error: any) {
      message.error(error.message || 'Failed to fetch data');
      setData([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [fetchFn]);

  // Initial fetch on mount
  useEffect(() => {
    const initialParams = {
      page: 1,
      page_size: defaultPageSize,
      ...defaultParams,
    } as P;
    fetchData(initialParams);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchData]);

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

  const handleSearch = useCallback(() => {
    setPage(1);
    const newParams = { ...params, page: 1 };
    setParamsState(newParams);
    fetchData(newParams);
  }, [params, fetchData]);

  return {
    data,
    total,
    loading,
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
