package project

import (
	"sort"
)

// Paginate applies the Store contract's owner filter, stable ordering, and
// keyset continuation to a snapshot of complete Project documents.
func Paginate(rows []Project, request PageRequest) Page {
	filtered := make([]Project, 0, len(rows))
	for _, row := range rows {
		if request.OwnershipEnforced && (request.Owner == nil || !request.Owner.SameIdentity(row.Owner)) {
			continue
		}
		filtered = append(filtered, row.Clone())
	}
	sort.Slice(filtered, func(i, j int) bool {
		if !filtered[i].UpdatedAt.Equal(filtered[j].UpdatedAt) {
			return filtered[i].UpdatedAt.After(filtered[j].UpdatedAt)
		}
		return filtered[i].ID < filtered[j].ID
	})

	start := 0
	if request.Cursor != nil {
		start = len(filtered)
		for i, row := range filtered {
			if row.UpdatedAt.Before(request.Cursor.UpdatedAt) ||
				(row.UpdatedAt.Equal(request.Cursor.UpdatedAt) && row.ID > request.Cursor.ID) {
				start = i
				break
			}
		}
	}
	limit := request.Limit
	if limit < 0 {
		limit = 0
	}
	end := start + limit
	if end > len(filtered) {
		end = len(filtered)
	}
	page := Page{Projects: filtered[start:end], TotalCount: len(filtered)}
	if end < len(filtered) && end > start {
		last := filtered[end-1]
		page.NextCursor = &Cursor{UpdatedAt: last.UpdatedAt, ID: last.ID}
	}
	return page
}
