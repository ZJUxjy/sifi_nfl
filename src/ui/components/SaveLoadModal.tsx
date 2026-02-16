import { useState, useEffect } from 'react';
import {
  Modal,
  Button,
  Table,
  Badge,
  Spinner,
  Alert,
  Form,
  InputGroup,
} from 'react-bootstrap';
import { useGameStore } from '../stores/gameStore';

interface SaveLoadModalProps {
  show: boolean;
  onHide: () => void;
  mode: 'save' | 'load';
}

interface SaveInfo {
  name: string;
  timestamp: number;
  season: number;
  week: number;
  teamName: string;
}

function SaveLoadModal({ show, onHide, mode }: SaveLoadModalProps) {
  const { season, week, saveGame, loadGame, listSaves } = useGameStore();

  const [saves, setSaves] = useState<SaveInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saveName, setSaveName] = useState('');
  const [selectedSave, setSelectedSave] = useState<string | null>(null);

  // Load saves list
  useEffect(() => {
    if (show) {
      loadSavesList();
    }
  }, [show]);

  const loadSavesList = async () => {
    setLoading(true);
    setError(null);

    try {
      const saveList = await listSaves();

      const saveInfos: SaveInfo[] = saveList.map((save: any) => ({
        name: save.name,
        timestamp: save.timestamp,
        season: save.state?.season || 0,
        week: save.state?.week || 0,
        teamName: save.state?.teams?.find(
          (t: any) => t.tid === save.state?.userTid
        )?.name || 'Unknown',
      }));

      // Sort by timestamp descending
      saveInfos.sort((a, b) => b.timestamp - a.timestamp);
      setSaves(saveInfos);
    } catch (err) {
      console.error('Failed to load saves:', err);
      setError('Failed to load save list');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!saveName.trim()) {
      setError('Please enter a save name');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await saveGame(saveName.trim());
      setSuccess(`Game saved as "${saveName}"`);
      setSaveName('');
      await loadSavesList();

      // Auto-close after success
      setTimeout(() => {
        onHide();
      }, 1500);
    } catch (err) {
      console.error('Failed to save:', err);
      setError('Failed to save game');
    } finally {
      setSaving(false);
    }
  };

  const handleLoad = async () => {
    if (!selectedSave) {
      setError('Please select a save to load');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await loadGame(selectedSave);
      setSuccess('Game loaded successfully!');

      // Auto-close after success
      setTimeout(() => {
        onHide();
      }, 1000);
    } catch (err) {
      console.error('Failed to load:', err);
      setError('Failed to load game');
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <Modal show={show} onHide={onHide} size="lg" centered>
      <Modal.Header closeButton>
        <Modal.Title>
          {mode === 'save' ? '💾 Save Game' : '📂 Load Game'}
        </Modal.Title>
      </Modal.Header>

      <Modal.Body>
        {error && (
          <Alert variant="danger" onClose={() => setError(null)} dismissible>
            {error}
          </Alert>
        )}

        {success && (
          <Alert variant="success" onClose={() => setSuccess(null)} dismissible>
            {success}
          </Alert>
        )}

        {mode === 'save' && (
          <div className="mb-4">
            <Form.Group className="mb-3">
              <Form.Label>Save Name</Form.Label>
              <InputGroup>
                <Form.Control
                  type="text"
                  placeholder="Enter save name..."
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                />
                <Button
                  variant="primary"
                  onClick={handleSave}
                  disabled={saving || !saveName.trim()}
                >
                  {saving ? (
                    <>
                      <Spinner animation="border" size="sm" className="me-2" />
                      Saving...
                    </>
                  ) : (
                    'Save'
                  )}
                </Button>
              </InputGroup>
            </Form.Group>

            <div className="text-muted small">
              Current: Season {season}, Week {week}
            </div>
          </div>
        )}

        <h6>Existing Saves</h6>

        {loading ? (
          <div className="text-center py-4">
            <Spinner animation="border" />
          </div>
        ) : saves.length === 0 ? (
          <div className="text-center py-4 text-muted">
            No saved games found
          </div>
        ) : (
          <div style={{ maxHeight: 300, overflowY: 'auto' }}>
            <Table hover size="sm">
              <thead>
                <tr>
                  {mode === 'load' && <th></th>}
                  <th>Name</th>
                  <th>Team</th>
                  <th>Season</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {saves.map((save) => (
                  <tr
                    key={save.name}
                    className={mode === 'load' ? 'cursor-pointer' : ''}
                    onClick={() => mode === 'load' && setSelectedSave(save.name)}
                    style={mode === 'load' ? { cursor: 'pointer' } : {}}
                  >
                    {mode === 'load' && (
                      <td>
                        <Form.Check
                          type="radio"
                          name="selectedSave"
                          checked={selectedSave === save.name}
                          onChange={() => setSelectedSave(save.name)}
                        />
                      </td>
                    )}
                    <td>{save.name}</td>
                    <td>{save.teamName}</td>
                    <td>
                      <Badge bg="secondary">
                        S{save.season} W{save.week}
                      </Badge>
                    </td>
                    <td className="text-muted small">
                      {formatDate(save.timestamp)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          Cancel
        </Button>
        {mode === 'load' && (
          <Button
            variant="primary"
            onClick={handleLoad}
            disabled={saving || !selectedSave}
          >
            {saving ? (
              <>
                <Spinner animation="border" size="sm" className="me-2" />
                Loading...
              </>
            ) : (
              'Load Game'
            )}
          </Button>
        )}
      </Modal.Footer>
    </Modal>
  );
}

export default SaveLoadModal;
