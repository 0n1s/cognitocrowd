"use client";

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Task } from '@/lib/types';

const TASKS_PER_PAGE = 5;

export const CompletedTasksTable = ({ tasks }: { tasks: Task[] }) => {
    const [currentPage, setCurrentPage] = useState(1);
    const totalPages = Math.ceil(tasks.length / TASKS_PER_PAGE);

    const startIndex = (currentPage - 1) * TASKS_PER_PAGE;
    const paginatedTasks = tasks.slice(startIndex, startIndex + TASKS_PER_PAGE);

    const handlePrevPage = () => {
        setCurrentPage((prev) => Math.max(prev - 1, 1));
    };

    const handleNextPage = () => {
        setCurrentPage((prev) => Math.min(prev + 1, totalPages));
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Completed Contributions</CardTitle>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Title</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead className="text-right">Points</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {paginatedTasks.length > 0 ? paginatedTasks.map((task) => (
                            <TableRow key={task.id}>
                                <TableCell>{task.title}</TableCell>
                                <TableCell>{task.type}</TableCell>
                                <TableCell className="text-right">{task.points}</TableCell>
                            </TableRow>
                        )) : (
                            <TableRow>
                                <TableCell colSpan={3} className="text-center">No contributions completed yet.</TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
                {totalPages > 1 && (
                    <div className="flex items-center justify-end space-x-2 py-4">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handlePrevPage}
                            disabled={currentPage === 1}
                        >
                            Previous
                        </Button>
                        <span className="text-sm text-muted-foreground">
                            Page {currentPage} of {totalPages}
                        </span>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleNextPage}
                            disabled={currentPage === totalPages}
                        >
                            Next
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};
