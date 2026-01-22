import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { daysBetweenDateOnly } from '@/lib/date';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Search, Beef, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface AnimalComResumo {
  id: string;
  numero_brinco: string;
  peso_entrada: number;
  data_entrada: string;
  lote_id: string | null;
  lote_nome: string | null;
  peso_atual: number;
  ganho_total: number;
  gmd: number;
  dias_confinamento: number;
}

export default function Animais() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [loteFilter, setLoteFilter] = useState<string>('todos');

  const { data: lotes } = useQuery({
    queryKey: ['lotes', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lotes')
        .select('id, nome')
        .order('nome');
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: animais, isLoading } = useQuery({
    queryKey: ['animais-lista', user?.id, search, loteFilter],
    queryFn: async (): Promise<AnimalComResumo[]> => {
      // Fetch animais
      let query = supabase
        .from('animais')
        .select(`
          id,
          numero_brinco,
          peso_entrada,
          data_entrada,
          lote_id,
          lotes(nome)
        `)
        .order('numero_brinco');

      if (search) {
        query = query.ilike('numero_brinco', `%${search}%`);
      }

      if (loteFilter && loteFilter !== 'todos') {
        query = query.eq('lote_id', loteFilter);
      }

      const { data: animaisData, error } = await query;
      if (error) throw error;
      if (!animaisData || animaisData.length === 0) return [];

      // Fetch últimas pesagens
      const animalIds = animaisData.map((a) => a.id);
      const { data: pesagens } = await supabase
        .from('pesagens')
        .select('animal_id, peso, data, created_at')
        .in('animal_id', animalIds)
        .order('data', { ascending: false })
        .order('created_at', { ascending: false });

      const ultimasPesagens = new Map();
      pesagens?.forEach(p => {
        if (!ultimasPesagens.has(p.animal_id)) {
          ultimasPesagens.set(p.animal_id, p);
        }
      });

      return animaisData.map(animal => {
        const ultimaPesagem = ultimasPesagens.get(animal.id);
        const pesoAtual = ultimaPesagem ? Number(ultimaPesagem.peso) : Number(animal.peso_entrada);
        const ganhoTotal = pesoAtual - Number(animal.peso_entrada);
        const diasConfinamento = daysBetweenDateOnly(animal.data_entrada);
        const gmd = ganhoTotal / diasConfinamento;

        return {
          id: animal.id,
          numero_brinco: animal.numero_brinco,
          peso_entrada: Number(animal.peso_entrada),
          data_entrada: animal.data_entrada,
          lote_id: animal.lote_id,
          lote_nome: (animal.lotes as any)?.nome || null,
          peso_atual: pesoAtual,
          ganho_total: ganhoTotal,
          gmd: Number(gmd.toFixed(2)),
          dias_confinamento: diasConfinamento,
        };
      });
    },
    enabled: !!user,
  });

  const getGMDBadge = (gmd: number) => {
    if (gmd >= 1.3) return { label: '⭐', variant: 'default' as const };
    if (gmd >= 0.8) return { label: '', variant: 'secondary' as const };
    if (gmd >= 0.5) return { label: '⚠️', variant: 'outline' as const };
    return { label: '🔴', variant: 'destructive' as const };
  };

  return (
    <AppLayout>
      <div className="container py-6">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Animais</h1>
            <p className="text-muted-foreground">
              {animais?.length || 0} animais ativos
            </p>
          </div>
          <Button asChild className="hidden sm:flex">
            <Link to="/animais/novo">
              <Plus className="mr-2 h-4 w-4" />
              Novo Animal
            </Link>
          </Button>
        </div>

        {/* Filters */}
        <div className="mb-4 flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por brinco..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={loteFilter} onValueChange={setLoteFilter}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Filtrar por lote" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os lotes</SelectItem>
              {lotes?.map((lote) => (
                <SelectItem key={lote.id} value={lote.id}>
                  {lote.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Animals List */}
        {isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <Skeleton className="mb-2 h-6 w-20" />
                  <Skeleton className="mb-4 h-4 w-32" />
                  <Skeleton className="h-8 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : animais && animais.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {animais.map((animal) => (
              <Link key={animal.id} to={`/animais/${animal.id}`}>
                <Card className="transition-shadow hover:shadow-md">
                  <CardContent className="p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Beef className="h-5 w-5 text-primary" />
                        <span className="text-lg font-semibold">
                          #{animal.numero_brinco}
                        </span>
                      </div>
                      {animal.gmd >= 1.3 && (
                        <Badge variant="default">⭐</Badge>
                      )}
                    </div>
                    
                    <p className="mb-3 text-sm text-muted-foreground">
                      {animal.lote_nome || 'Sem lote'}
                    </p>

                    <div className="flex items-center justify-between rounded-lg bg-muted p-2">
                      <div className="text-center">
                        <p className="text-lg font-bold">{animal.peso_atual}kg</p>
                        <p className="text-xs text-muted-foreground">
                          +{animal.ganho_total}kg
                        </p>
                      </div>
                      <div className="flex items-center gap-1 text-sm">
                        <TrendingUp className="h-4 w-4 text-primary" />
                        <span className="font-medium">{animal.gmd} kg/dia</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Beef className="mb-4 h-12 w-12 text-muted-foreground" />
              <h3 className="mb-2 text-lg font-semibold">Nenhum animal encontrado</h3>
              <p className="mb-4 text-center text-sm text-muted-foreground">
                {search ? 'Tente outra busca' : 'Comece cadastrando seu primeiro animal'}
              </p>
              {!search && (
                <Button asChild>
                  <Link to="/animais/novo">
                    <Plus className="mr-2 h-4 w-4" />
                    Cadastrar Animal
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Mobile FAB */}
        <div className="fixed bottom-20 right-4 md:hidden">
          <Button size="lg" className="h-14 w-14 rounded-full shadow-lg" asChild>
            <Link to="/animais/novo">
              <Plus className="h-6 w-6" />
            </Link>
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
