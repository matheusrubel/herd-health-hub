import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Syringe } from 'lucide-react';

export default function Sanitario() {
  return (
    <AppLayout>
      <div className="container py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Sanitário</h1>
          <p className="text-muted-foreground">Protocolos e tratamentos</p>
        </div>

        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Syringe className="mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="mb-2 text-lg font-semibold">Em breve</h3>
            <p className="text-center text-sm text-muted-foreground">
              Controle de vacinas, vermífugos e tratamentos
            </p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
