import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Plus, Users, Loader2, Trash2, Edit, Tag, Pill, DollarSign, Settings } from 'lucide-react';

export default function Configuracoes() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Estados dos modais
  const [racaModalOpen, setRacaModalOpen] = useState(false);
  const [tipoProtocoloModalOpen, setTipoProtocoloModalOpen] = useState(false);
  const [produtoModalOpen, setProdutoModalOpen] = useState(false);
  const [tipoGastoModalOpen, setTipoGastoModalOpen] = useState(false);
  const [responsavelModalOpen, setResponsavelModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Estados de edição
  const [editandoRaca, setEditandoRaca] = useState<any>(null);
  const [editandoTipoProtocolo, setEditandoTipoProtocolo] = useState<any>(null);
  const [editandoProduto, setEditandoProduto] = useState<any>(null);
  const [editandoTipoGasto, setEditandoTipoGasto] = useState<any>(null);
  const [editandoResponsavel, setEditandoResponsavel] = useState<any>(null);
  const [itemDeletar, setItemDeletar] = useState<{ table: string; id: string } | null>(null);

  // Form states
  const [nomeRaca, setNomeRaca] = useState('');
  const [nomeTipoProtocolo, setNomeTipoProtocolo] = useState('');
  const [nomeProduto, setNomeProduto] = useState('');
  const [nomeTipoGasto, setNomeTipoGasto] = useState('');
  const [nomeResponsavel, setNomeResponsavel] = useState('');
  const [statusResponsavel, setStatusResponsavel] = useState('Ativo');

  // ═══════════════════════════════════════════
  // QUERIES
  // ═══════════════════════════════════════════

  const { data: racas, isLoading: racasLoading } = useQuery({
    queryKey: ['racas', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('racas')
        .select('*')
        .order('nome');
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: tiposProtocolo, isLoading: tiposProtocoloLoading } = useQuery({
    queryKey: ['tipos-protocolo', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tipos_protocolo')
        .select('*')
        .order('nome');
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: produtos, isLoading: produtosLoading } = useQuery({
    queryKey: ['produtos-sanitarios', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('produtos_sanitarios')
        .select('*')
        .order('nome');
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: tiposGasto, isLoading: tiposGastoLoading } = useQuery({
    queryKey: ['tipos-gasto', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tipos_gasto')
        .select('*')
        .order('nome');
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: responsaveis, isLoading: responsaveisLoading } = useQuery({
    queryKey: ['responsaveis', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('responsaveis')
        .select('*')
        .order('nome');
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // ═══════════════════════════════════════════
  // MUTATIONS
  // ═══════════════════════════════════════════

  const saveRacaMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Não autenticado');
      if (editandoRaca) {
        const { error } = await supabase
          .from('racas')
          .update({ nome: nomeRaca.trim() })
          .eq('id', editandoRaca.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('racas')
          .insert({ user_id: user.id, nome: nomeRaca.trim() });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['racas'] });
      toast.success(editandoRaca ? 'Raça atualizada!' : 'Raça cadastrada!');
      setRacaModalOpen(false);
      setNomeRaca('');
      setEditandoRaca(null);
    },
    onError: (error: any) => {
      toast.error('Erro ao salvar', { description: error.message });
    },
  });

  const saveTipoProtocoloMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Não autenticado');
      if (editandoTipoProtocolo) {
        const { error } = await supabase
          .from('tipos_protocolo')
          .update({ nome: nomeTipoProtocolo.trim() })
          .eq('id', editandoTipoProtocolo.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('tipos_protocolo')
          .insert({ user_id: user.id, nome: nomeTipoProtocolo.trim() });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tipos-protocolo'] });
      toast.success(editandoTipoProtocolo ? 'Tipo atualizado!' : 'Tipo cadastrado!');
      setTipoProtocoloModalOpen(false);
      setNomeTipoProtocolo('');
      setEditandoTipoProtocolo(null);
    },
    onError: (error: any) => {
      toast.error('Erro ao salvar', { description: error.message });
    },
  });

  const saveProdutoMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Não autenticado');
      if (editandoProduto) {
        const { error } = await supabase
          .from('produtos_sanitarios')
          .update({ nome: nomeProduto.trim() })
          .eq('id', editandoProduto.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('produtos_sanitarios')
          .insert({ user_id: user.id, nome: nomeProduto.trim() });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['produtos-sanitarios'] });
      toast.success(editandoProduto ? 'Produto atualizado!' : 'Produto cadastrado!');
      setProdutoModalOpen(false);
      setNomeProduto('');
      setEditandoProduto(null);
    },
    onError: (error: any) => {
      toast.error('Erro ao salvar', { description: error.message });
    },
  });

  const saveTipoGastoMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Não autenticado');
      if (editandoTipoGasto) {
        const { error } = await supabase
          .from('tipos_gasto')
          .update({ nome: nomeTipoGasto.trim() })
          .eq('id', editandoTipoGasto.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('tipos_gasto')
          .insert({ user_id: user.id, nome: nomeTipoGasto.trim() });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tipos-gasto'] });
      toast.success(editandoTipoGasto ? 'Tipo atualizado!' : 'Tipo cadastrado!');
      setTipoGastoModalOpen(false);
      setNomeTipoGasto('');
      setEditandoTipoGasto(null);
    },
    onError: (error: any) => {
      toast.error('Erro ao salvar', { description: error.message });
    },
  });

  const saveResponsavelMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Não autenticado');
      if (editandoResponsavel) {
        const { error } = await supabase
          .from('responsaveis')
          .update({ nome: nomeResponsavel.trim(), status: statusResponsavel })
          .eq('id', editandoResponsavel.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('responsaveis')
          .insert({ user_id: user.id, nome: nomeResponsavel.trim(), status: statusResponsavel });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['responsaveis'] });
      toast.success(editandoResponsavel ? 'Responsável atualizado!' : 'Responsável cadastrado!');
      setResponsavelModalOpen(false);
      setNomeResponsavel('');
      setStatusResponsavel('Ativo');
      setEditandoResponsavel(null);
    },
    onError: (error: any) => {
      toast.error('Erro ao salvar', { description: error.message });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ table, id }: { table: string; id: string }) => {
      const { error } = await supabase
        .from(table)
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['racas'] });
      queryClient.invalidateQueries({ queryKey: ['tipos-protocolo'] });
      queryClient.invalidateQueries({ queryKey: ['produtos-sanitarios'] });
      queryClient.invalidateQueries({ queryKey: ['tipos-gasto'] });
      queryClient.invalidateQueries({ queryKey: ['responsaveis'] });
      toast.success('Item removido!');
      setDeleteDialogOpen(false);
      setItemDeletar(null);
    },
    onError: (error: any) => {
      toast.error('Erro ao remover', { description: error.message });
    },
  });

  // ═══════════════════════════════════════════
  // HANDLERS
  // ═══════════════════════════════════════════

  const handleDelete = (table: string, id: string) => {
    setItemDeletar({ table, id });
    setDeleteDialogOpen(true);
  };

  return (
    <AppLayout>
      <div className="container py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Settings className="h-6 w-6" />
            Configurações
          </h1>
          <p className="text-muted-foreground">Gerencie raças, tipos e produtos</p>
        </div>

        <Tabs defaultValue="racas" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2 lg:grid-cols-5">
            <TabsTrigger value="racas" className="gap-2">
              <Tag className="h-4 w-4" />
              Raças
            </TabsTrigger>
            <TabsTrigger value="tipos-protocolo" className="gap-2">
              <Pill className="h-4 w-4" />
              Tipos Protocolo
            </TabsTrigger>
            <TabsTrigger value="produtos" className="gap-2">
              <Pill className="h-4 w-4" />
              Produtos
            </TabsTrigger>
            <TabsTrigger value="tipos-gasto" className="gap-2">
              <DollarSign className="h-4 w-4" />
              Tipos Gasto
            </TabsTrigger>
            <TabsTrigger value="responsaveis" className="gap-2">
              <Users className="h-4 w-4" />
              Responsáveis
            </TabsTrigger>
          </TabsList>

          {/* ═══════════════════════════════════════════ */}
          {/* ABA 1: RAÇAS */}
          {/* ═══════════════════════════════════════════ */}
          <TabsContent value="racas">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Raças</CardTitle>
                <Dialog open={racaModalOpen} onOpenChange={setRacaModalOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" onClick={() => { setEditandoRaca(null); setNomeRaca(''); }}>
                      <Plus className="mr-2 h-4 w-4" />
                      Nova Raça
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{editandoRaca ? 'Editar' : 'Nova'} Raça</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={(e) => { e.preventDefault(); saveRacaMutation.mutate(); }} className="space-y-4">
                      <div className="space-y-2">
                        <Label>Nome *</Label>
                        <Input
                          placeholder="Ex: Nelore"
                          value={nomeRaca}
                          onChange={(e) => setNomeRaca(e.target.value)}
                          required
                        />
                      </div>
                      <div className="flex gap-3">
                        <Button type="button" variant="outline" className="flex-1" onClick={() => setRacaModalOpen(false)}>
                          Cancelar
                        </Button>
                        <Button type="submit" className="flex-1" disabled={saveRacaMutation.isPending}>
                          {saveRacaMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar'}
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {racasLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : racas && racas.length > 0 ? (
                  <div className="grid gap-2">
                    {racas.map((r) => (
                      <div key={r.id} className="flex items-center justify-between rounded-lg border p-3">
                        <span className="font-medium">{r.nome}</span>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => {
                            setEditandoRaca(r);
                            setNomeRaca(r.nome);
                            setRacaModalOpen(true);
                          }}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete('racas', r.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="py-8 text-center text-muted-foreground">Nenhuma raça cadastrada</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ═══════════════════════════════════════════ */}
          {/* ABA 2: TIPOS DE PROTOCOLO */}
          {/* ═══════════════════════════════════════════ */}
          <TabsContent value="tipos-protocolo">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Tipos de Protocolo</CardTitle>
                <Dialog open={tipoProtocoloModalOpen} onOpenChange={setTipoProtocoloModalOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" onClick={() => { setEditandoTipoProtocolo(null); setNomeTipoProtocolo(''); }}>
                      <Plus className="mr-2 h-4 w-4" />
                      Novo Tipo
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{editandoTipoProtocolo ? 'Editar' : 'Novo'} Tipo</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={(e) => { e.preventDefault(); saveTipoProtocoloMutation.mutate(); }} className="space-y-4">
                      <div className="space-y-2">
                        <Label>Nome *</Label>
                        <Input
                          placeholder="Ex: Vacina"
                          value={nomeTipoProtocolo}
                          onChange={(e) => setNomeTipoProtocolo(e.target.value)}
                          required
                        />
                      </div>
                      <div className="flex gap-3">
                        <Button type="button" variant="outline" className="flex-1" onClick={() => setTipoProtocoloModalOpen(false)}>
                          Cancelar
                        </Button>
                        <Button type="submit" className="flex-1" disabled={saveTipoProtocoloMutation.isPending}>
                          {saveTipoProtocoloMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar'}
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {tiposProtocoloLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : tiposProtocolo && tiposProtocolo.length > 0 ? (
                  <div className="grid gap-2">
                    {tiposProtocolo.map((t) => (
                      <div key={t.id} className="flex items-center justify-between rounded-lg border p-3">
                        <span className="font-medium">{t.nome}</span>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => {
                            setEditandoTipoProtocolo(t);
                            setNomeTipoProtocolo(t.nome);
                            setTipoProtocoloModalOpen(true);
                          }}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete('tipos_protocolo', t.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="py-8 text-center text-muted-foreground">Nenhum tipo cadastrado</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ═══════════════════════════════════════════ */}
          {/* ABA 3: PRODUTOS SANITÁRIOS */}
          {/* ═══════════════════════════════════════════ */}
          <TabsContent value="produtos">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Produtos Sanitários</CardTitle>
                <Dialog open={produtoModalOpen} onOpenChange={setProdutoModalOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" onClick={() => { setEditandoProduto(null); setNomeProduto(''); }}>
                      <Plus className="mr-2 h-4 w-4" />
                      Novo Produto
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{editandoProduto ? 'Editar' : 'Novo'} Produto</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={(e) => { e.preventDefault(); saveProdutoMutation.mutate(); }} className="space-y-4">
                      <div className="space-y-2">
                        <Label>Nome *</Label>
                        <Input
                          placeholder="Ex: Ivermectina"
                          value={nomeProduto}
                          onChange={(e) => setNomeProduto(e.target.value)}
                          required
                        />
                      </div>
                      <div className="flex gap-3">
                        <Button type="button" variant="outline" className="flex-1" onClick={() => setProdutoModalOpen(false)}>
                          Cancelar
                        </Button>
                        <Button type="submit" className="flex-1" disabled={saveProdutoMutation.isPending}>
                          {saveProdutoMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar'}
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {produtosLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : produtos && produtos.length > 0 ? (
                  <div className="grid gap-2">
                    {produtos.map((p) => (
                      <div key={p.id} className="flex items-center justify-between rounded-lg border p-3">
                        <span className="font-medium">{p.nome}</span>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => {
                            setEditandoProduto(p);
                            setNomeProduto(p.nome);
                            setProdutoModalOpen(true);
                          }}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete('produtos_sanitarios', p.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="py-8 text-center text-muted-foreground">Nenhum produto cadastrado</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ═══════════════════════════════════════════ */}
          {/* ABA 4: TIPOS DE GASTO */}
          {/* ═══════════════════════════════════════════ */}
          <TabsContent value="tipos-gasto">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Tipos de Gasto</CardTitle>
                <Dialog open={tipoGastoModalOpen} onOpenChange={setTipoGastoModalOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" onClick={() => { setEditandoTipoGasto(null); setNomeTipoGasto(''); }}>
                      <Plus className="mr-2 h-4 w-4" />
                      Novo Tipo
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{editandoTipoGasto ? 'Editar' : 'Novo'} Tipo</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={(e) => { e.preventDefault(); saveTipoGastoMutation.mutate(); }} className="space-y-4">
                      <div className="space-y-2">
                        <Label>Nome *</Label>
                        <Input
                          placeholder="Ex: Transporte"
                          value={nomeTipoGasto}
                          onChange={(e) => setNomeTipoGasto(e.target.value)}
                          required
                        />
                      </div>
                      <div className="flex gap-3">
                        <Button type="button" variant="outline" className="flex-1" onClick={() => setTipoGastoModalOpen(false)}>
                          Cancelar
                        </Button>
                        <Button type="submit" className="flex-1" disabled={saveTipoGastoMutation.isPending}>
                          {saveTipoGastoMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar'}
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {tiposGastoLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : tiposGasto && tiposGasto.length > 0 ? (
                  <div className="grid gap-2">
                    {tiposGasto.map((t) => (
                      <div key={t.id} className="flex items-center justify-between rounded-lg border p-3">
                        <span className="font-medium">{t.nome}</span>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => {
                            setEditandoTipoGasto(t);
                            setNomeTipoGasto(t.nome);
                            setTipoGastoModalOpen(true);
                          }}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete('tipos_gasto', t.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="py-8 text-center text-muted-foreground">Nenhum tipo cadastrado</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ═══════════════════════════════════════════ */}
          {/* ABA 5: RESPONSÁVEIS */}
          {/* ═══════════════════════════════════════════ */}
          <TabsContent value="responsaveis">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Responsáveis</CardTitle>
                <Dialog open={responsavelModalOpen} onOpenChange={setResponsavelModalOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" onClick={() => { setEditandoResponsavel(null); setNomeResponsavel(''); setStatusResponsavel('Ativo'); }}>
                      <Plus className="mr-2 h-4 w-4" />
                      Novo Responsável
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{editandoResponsavel ? 'Editar' : 'Novo'} Responsável</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={(e) => { e.preventDefault(); saveResponsavelMutation.mutate(); }} className="space-y-4">
                      <div className="space-y-2">
                        <Label>Nome *</Label>
                        <Input
                          placeholder="Ex: João Silva"
                          value={nomeResponsavel}
                          onChange={(e) => setNomeResponsavel(e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Status</Label>
                        <select
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={statusResponsavel}
                          onChange={(e) => setStatusResponsavel(e.target.value)}
                        >
                          <option value="Ativo">Ativo</option>
                          <option value="Inativo">Inativo</option>
                        </select>
                      </div>
                      <div className="flex gap-3">
                        <Button type="button" variant="outline" className="flex-1" onClick={() => setResponsavelModalOpen(false)}>
                          Cancelar
                        </Button>
                        <Button type="submit" className="flex-1" disabled={saveResponsavelMutation.isPending}>
                          {saveResponsavelMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar'}
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {responsaveisLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : responsaveis && responsaveis.length > 0 ? (
                  <div className="grid gap-2">
                    {responsaveis.map((r) => (
                      <div key={r.id} className="flex items-center justify-between rounded-lg border p-3">
                        <div className="flex items-center gap-3">
                          <span className="font-medium">{r.nome}</span>
                          <Badge variant={r.status === 'Ativo' ? 'default' : 'secondary'}>
                            {r.status}
                          </Badge>
                        </div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => {
                            setEditandoResponsavel(r);
                            setNomeResponsavel(r.nome);
                            setStatusResponsavel(r.status || 'Ativo');
                            setResponsavelModalOpen(true);
                          }}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete('responsaveis', r.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="py-8 text-center text-muted-foreground">Nenhum responsável cadastrado</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Dialog de Confirmação de Exclusão */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja remover este item? Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => itemDeletar && deleteMutation.mutate(itemDeletar)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Remover'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}