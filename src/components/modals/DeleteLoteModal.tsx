import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Loader2, Package, ArrowRight, XCircle } from 'lucide-react';

interface DeleteLoteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lote: {
    id: string;
    nome: string;
  };
  animaisAtivos: number;
}

export function DeleteLoteModal({ open, onOpenChange, lote, animaisAtivos }: DeleteLoteModalProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [acao, setAcao] = useState<'mover' | 'finalizar' | null>(null);
  const [loteDestinoId, setLoteDestinoId] = useState('');
  const [confirmado, setConfirmado] = useState(false);

  // Fetch outros lotes
  const { data: outrosLotes } = useQuery({
    queryKey: ['outros-lotes', user?.id, lote.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lotes')
        .select('id, nome')
        .neq('id', lote.id)
        .order('nome');
      if (error) throw error;
      return data;
    },
    enabled: !!user && open && animaisAtivos > 0,
  });

  // Mutation para soft delete (lote vazio)
  const deleteMutation = useMutation({
    mutationFn: async () => {
      // Log before delete
      await supabase
        .from('logs_exclusao_lotes')
        .insert({
          user_id: user!.id,
          lote_id: lote.id,
          lote_nome: lote.nome,
          acao: 'hard_delete',
          animais_afetados: 0,
        });

      const { error } = await supabase
        .from('lotes')
        .delete()
        .eq('id', lote.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lotes'] });
      toast.success('Lote excluído com sucesso!');
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error('Erro ao excluir lote', {
        description: error.message,
      });
    },
  });

  // Mutation para mover animais
  const moverMutation = useMutation({
    mutationFn: async () => {
      if (!loteDestinoId) throw new Error('Selecione o lote de destino');

      // Get animais do lote
      const { data: animais } = await supabase
        .from('animais')
        .select('id')
        .eq('lote_id', lote.id);

      if (animais && animais.length > 0) {
        // Mover animais
        const { error: moveError } = await supabase
          .from('animais')
          .update({ lote_id: loteDestinoId })
          .eq('lote_id', lote.id);

        if (moveError) throw moveError;

        // Registrar movimentações
        const movimentacoes = animais.map(a => ({
          user_id: user!.id,
          animal_id: a.id,
          lote_origem_id: lote.id,
          lote_destino_id: loteDestinoId,
          data: new Date().toISOString().split('T')[0],
          motivo: 'Reorganização - Lote arquivado',
        }));

        await supabase
          .from('movimentacoes_lotes')
          .insert(movimentacoes);
      }

      // Deletar lote
      const { error: deleteError } = await supabase
        .from('lotes')
        .delete()
        .eq('id', lote.id);

      if (deleteError) throw deleteError;

      // Log
      await supabase
        .from('logs_exclusao_lotes')
        .insert({
          user_id: user!.id,
          lote_id: lote.id,
          lote_nome: lote.nome,
          acao: 'mover',
          animais_afetados: animais?.length || 0,
          lote_destino_id: loteDestinoId,
        });

      return animais?.length || 0;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['lotes'] });
      queryClient.invalidateQueries({ queryKey: ['animais'] });
      toast.success(`${count} animais movidos. Lote arquivado!`);
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error('Erro ao mover animais', {
        description: error.message,
      });
    },
  });

  // Mutation para finalizar animais
  const finalizarMutation = useMutation({
    mutationFn: async () => {
      // Inativar todos animais do lote
      const { data: animais } = await supabase
        .from('animais')
        .select('id')
        .eq('lote_id', lote.id);

      if (animais && animais.length > 0) {
        // Deletar todos animais do lote
        const { error: deleteAnimaisError } = await supabase
          .from('animais')
          .delete()
          .eq('lote_id', lote.id);

        if (deleteAnimaisError) throw deleteAnimaisError;
      }

      // Deletar lote
      const { error: deleteError } = await supabase
        .from('lotes')
        .delete()
        .eq('id', lote.id);

      if (deleteError) throw deleteError;

      // Log
      await supabase
        .from('logs_exclusao_lotes')
        .insert({
          user_id: user!.id,
          lote_id: lote.id,
          lote_nome: lote.nome,
          acao: 'finalizar',
          animais_afetados: animais?.length || 0,
          detalhes: { motivo: 'Fim de ciclo - Abate/Venda' },
        });

      return animais?.length || 0;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['lotes'] });
      queryClient.invalidateQueries({ queryKey: ['animais'] });
      toast.success(`${count} animais excluídos. Lote excluído!`);
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error('Erro ao finalizar animais', {
        description: error.message,
      });
    },
  });

  const handleConfirm = () => {
    if (animaisAtivos === 0) {
      deleteMutation.mutate();
    } else {
      if (!confirmado) {
        toast.error('Por favor, confirme a ação');
        return;
      }

      if (acao === 'mover') {
        if (!loteDestinoId) {
          toast.error('Selecione o lote de destino');
          return;
        }
        moverMutation.mutate();
      } else if (acao === 'finalizar') {
        finalizarMutation.mutate();
      } else {
        toast.error('Selecione uma ação');
      }
    }
  };

  const isLoading = deleteMutation.isPending || moverMutation.isPending || finalizarMutation.isPending;

  // Lote vazio
  if (animaisAtivos === 0) {
    return (
      <AlertDialog open={open} onOpenChange={onOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Excluir Lote?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>⚠️ Excluir "{lote.nome}"?</p>
              <p>ℹ️ Este lote não possui animais.</p>
              <p className="text-destructive font-medium">Esta ação é permanente e não pode ser desfeita.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Excluindo...
                </>
              ) : (
                'Excluir'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  // Lote com animais
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-warning">
            ⚠️ Lote com Animais
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4">
              <p>
                Este lote possui <strong className="text-foreground">{animaisAtivos} ANIMAIS ATIVOS</strong>
              </p>
              <p>Escolha uma ação:</p>

              <RadioGroup value={acao || ''} onValueChange={(v) => setAcao(v as 'mover' | 'finalizar')}>
                <div className="space-y-3">
                  {/* Mover */}
                  <div className={`flex items-start space-x-3 rounded-lg border p-3 ${acao === 'mover' ? 'border-primary bg-primary/5' : ''}`}>
                    <RadioGroupItem value="mover" id="mover" />
                    <div className="flex-1">
                      <Label htmlFor="mover" className="flex cursor-pointer items-center gap-2 font-medium">
                        <ArrowRight className="h-4 w-4" />
                        Mover para outro lote
                      </Label>
                      {acao === 'mover' && (
                        <div className="mt-2">
                          <Select value={loteDestinoId} onValueChange={setLoteDestinoId}>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o lote destino" />
                            </SelectTrigger>
                            <SelectContent>
                              {outrosLotes?.map((l) => (
                                <SelectItem key={l.id} value={l.id}>
                                  {l.nome}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Finalizar */}
                  <div className={`flex items-start space-x-3 rounded-lg border p-3 ${acao === 'finalizar' ? 'border-primary bg-primary/5' : ''}`}>
                    <RadioGroupItem value="finalizar" id="finalizar" />
                    <div className="flex-1">
                      <Label htmlFor="finalizar" className="flex cursor-pointer items-center gap-2 font-medium">
                        <XCircle className="h-4 w-4" />
                        Finalizar todos (Abate/Venda)
                      </Label>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Marca todos os animais como inativos
                      </p>
                    </div>
                  </div>
                </div>
              </RadioGroup>

              {acao && (
                <div className="flex items-center space-x-2 pt-2">
                  <Checkbox 
                    id="confirmar" 
                    checked={confirmado} 
                    onCheckedChange={(c) => setConfirmado(!!c)} 
                  />
                  <Label htmlFor="confirmar" className="text-sm cursor-pointer">
                    Confirmo esta ação
                  </Label>
                </div>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Voltar</AlertDialogCancel>
          <AlertDialogAction 
            onClick={handleConfirm} 
            disabled={isLoading || !acao || !confirmado}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processando...
              </>
            ) : (
              'Confirmar'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
