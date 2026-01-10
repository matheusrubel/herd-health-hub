import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Wheat } from 'lucide-react';

export default function Dietas() {
  return (
    <AppLayout>
      <div className="container py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Dietas</h1>
          <p className="text-muted-foreground">Gestão de alimentação</p>
        </div>

        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Wheat className="mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="mb-2 text-lg font-semibold">Em breve</h3>
            <p className="text-center text-sm text-muted-foreground">
              Cadastro e controle de dietas alimentares
            </p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
