import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import DealStar from "@/components/deals/DealStar";

export default function StarTest() {
  return (
    <div className="min-h-screen bg-neutral-50 p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Star Component Test</h1>
        
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Empty star (count=0)</CardTitle>
            </CardHeader>
            <CardContent className="flex justify-center">
              <DealStar count={0} size="lg" />
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Filled star (count=5)</CardTitle>
            </CardHeader>
            <CardContent className="flex justify-center">
              <DealStar count={5} size="lg" />
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Explicit filled (filled=true)</CardTitle>
            </CardHeader>
            <CardContent className="flex justify-center">
              <DealStar count={0} filled={true} size="lg" />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
