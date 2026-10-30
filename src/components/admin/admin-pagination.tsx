import React from "react";
import { Button } from "@/components/ui/button";
import { m } from "@/paraglide/messages";

interface AdminPaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  currentPageItemCount: number;
  onPageChange: (page: number) => void;
}

const PAGE_BUTTON_CLASS = "w-8 px-0";

function getPageNumbers(
  currentPage: number,
  totalPages: number,
): Array<number | "..."> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  if (currentPage <= 4) {
    return [1, 2, 3, 4, 5, "...", totalPages];
  }

  if (currentPage >= totalPages - 3) {
    return [
      1,
      "...",
      totalPages - 4,
      totalPages - 3,
      totalPages - 2,
      totalPages - 1,
      totalPages,
    ];
  }

  return [
    1,
    "...",
    currentPage - 1,
    currentPage,
    currentPage + 1,
    "...",
    totalPages,
  ];
}

export function AdminPagination({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  currentPageItemCount,
  onPageChange,
}: AdminPaginationProps) {
  if (totalPages <= 1) return null;

  const pageNumbers = getPageNumbers(currentPage, totalPages);
  const startItem = Math.min((currentPage - 1) * itemsPerPage + 1, totalItems);
  const endItem = Math.min(startItem + currentPageItemCount - 1, totalItems);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4">
      <div className="text-sm fuwari-text-50">
        {m.admin_pagination_info({
          startItem,
          endItem,
          totalItems,
        })}
      </div>

      <div className="flex items-center gap-1">
        <Button
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className={PAGE_BUTTON_CLASS}
        >
          {"<"}
        </Button>

        {pageNumbers.map((pageNumber, index) => (
          <React.Fragment key={index}>
            {pageNumber === "..." ? (
              <div className="w-8 text-center text-sm fuwari-text-50">...</div>
            ) : (
              <Button
                size="sm"
                variant={currentPage === pageNumber ? "primary" : "regular"}
                onClick={() => onPageChange(pageNumber)}
                className={PAGE_BUTTON_CLASS}
              >
                {pageNumber}
              </Button>
            )}
          </React.Fragment>
        ))}

        <Button
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className={PAGE_BUTTON_CLASS}
        >
          {">"}
        </Button>
      </div>
    </div>
  );
}
